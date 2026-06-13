import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const configSchema = z.object({
  // Supabase
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // Anthropic
  ANTHROPIC_API_KEY: z.string().min(1),

  // Twilio
  TWILIO_ACCOUNT_SID: z.string().min(1),
  TWILIO_AUTH_TOKEN: z.string().min(1),
  TWILIO_PHONE_NUMBER: z.string().min(1),
  TWILIO_WHATSAPP_NUMBER: z.string().min(1),

  // ElevenLabs
  ELEVENLABS_API_KEY: z.string().min(1),
  ELEVENLABS_VOICE_ID: z.string().min(1),

  // Deepgram
  DEEPGRAM_API_KEY: z.string().min(1),

  // Resend
  RESEND_API_KEY: z.string().min(1),

  // Stripe
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  STRIPE_PRICE_ID: z.string().min(1),

  // App
  APP_URL: z.string().url(),
  FRONTEND_URL: z.string().url().optional(),  // production frontend domain (if separate from APP_URL)
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  // Admin secret for /api/admin/* routes — required when deploying
  ADMIN_SECRET: z.string().min(1).optional(),
});

const result = configSchema.safeParse(process.env);

if (!result.success) {
  const missing = result.error.issues.map((issue) => {
    const field = issue.path.join('.');
    return `  - ${field}: ${issue.message}`;
  });
  console.error('\n❌ Dewcall startup failed — missing or invalid environment variables:\n');
  console.error(missing.join('\n'));
  console.error('\nCopy .env.example to .env and fill in the required values.\n');
  process.exit(1);
}

export const config = result.data;
export type Config = typeof config;
