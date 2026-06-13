import { config } from './utils/config';
import { logger } from './utils/logger';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { WebSocketServer } from 'ws';
import routes from './routes/index';
import { startCallAgent } from './services/call-agent';
import { startScheduler } from './services/call-scheduler';

const app = express();

// ── CORS ────────────────────────────────────────────────────────────────────
// Explicit allowlist — open cors() was replaced to avoid exposing the API to
// arbitrary origins. Localhost ports cover Vite dev (5173) and preview (4173/4174).
const ALLOWED_ORIGINS = new Set<string>([
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:4174',
  config.APP_URL,
  ...(config.FRONTEND_URL ? [config.FRONTEND_URL] : []),
]);

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: (origin, cb) => {
    // No origin = server-to-server or same-origin (curl, Twilio webhooks, health checks)
    if (!origin || ALLOWED_ORIGINS.has(origin)) return cb(null, true);
    cb(new Error(`CORS: origin not allowed: ${origin}`));
  },
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ── Routes ──────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', app: 'Dewcall', env: process.env.NODE_ENV });
});

app.use(routes);

// ── HTTP + WebSocket server ───────────────────────────────────────────────────
const wss = new WebSocketServer({ noServer: true });

const server = app.listen(config.PORT, () => {
  logger.info(`Dewcall server running on port ${config.PORT} [${config.NODE_ENV}]`);
  logger.info(`Health check: http://localhost:${config.PORT}/health`);
});

// Route WebSocket upgrades to the call agent.
//
// /ws/stream        — primary path used by inline-TwiML outbound calls.
//                     callSid comes from Twilio's 'start' event, not the URL.
// /ws/call/:callSid — kept for webhook-based flows and manual testing.
server.on('upgrade', (req, socket, head) => {
  const pathname = new URL(req.url!, 'http://localhost').pathname;
  const callSidMatch = pathname.match(/^\/ws\/call\/([A-Za-z0-9]+)$/);
  const streamMatch  = pathname === '/ws/stream';

  if (streamMatch || callSidMatch) {
    const callSid = callSidMatch ? callSidMatch[1] : 'stream';
    wss.handleUpgrade(req, socket, head, (ws) => {
      startCallAgent(ws, callSid);
    });
  } else {
    socket.destroy();
  }
});

startScheduler();

// Railway sends SIGTERM before restarting or shutting down a deployment.
// Stop accepting new connections and close existing ones cleanly.
process.on('SIGTERM', () => {
  logger.info('SIGTERM received — shutting down gracefully');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });

  // Force-exit if connections don't drain within 10 seconds
  setTimeout(() => {
    logger.warn('Graceful shutdown timed out — forcing exit');
    process.exit(1);
  }, 10_000);
});

export { app, server };
