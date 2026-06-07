import { Router, Request, Response, NextFunction } from 'express';
import twilio from 'twilio';
import { config } from '../utils/config';
import { supabaseAdmin } from '../db/supabase';
import { generateBrief } from '../services/brief-generator';
import { deliverBrief } from '../services/brief-delivery';
import { logger } from '../utils/logger';

const router = Router();

// ── Twilio signature validation ──────────────────────────────────────────────
// Apply to every route in this router. Twilio signs the full request URL +
// form body; a mismatch means the request did not come from Twilio.

function validateTwilioSignature(req: Request, res: Response, next: NextFunction): void {
  // In development, skip validation — ngrok URL mismatches cause false 403s that
  // silently block the voice webhook, making it appear the webhook is never hit.
  // In production, always validate (Twilio signs every request with TWILIO_AUTH_TOKEN).
  if (config.NODE_ENV !== 'production') {
    logger.debug('Twilio signature validation skipped (dev mode)', { path: req.path });
    next();
    return;
  }

  const signature = req.headers['x-twilio-signature'] as string | undefined;
  if (!signature) {
    res.status(403).send('Forbidden');
    return;
  }
  const url = `${config.APP_URL}${req.originalUrl}`;
  const valid = twilio.validateRequest(config.TWILIO_AUTH_TOKEN, signature, url, req.body);
  if (!valid) {
    logger.warn('Invalid Twilio signature — request rejected', { url });
    res.status(403).send('Forbidden');
    return;
  }
  next();
}

router.use(validateTwilioSignature);

// ── POST /webhooks/twilio/voice ──────────────────────────────────────────────
// Twilio calls this when the senior's phone is answered.
// Return TwiML to connect the Twilio Media Stream to our WebSocket.

router.post('/voice', (req: Request, res: Response) => {
  const callSid = req.body.CallSid as string;
  logger.info('Twilio voice webhook', { callSid });

  // Derive WebSocket URL from APP_URL (https → wss, http → ws)
  const appHost = new URL(config.APP_URL).host;
  const wsUrl = `wss://${appHost}/ws/call/${callSid}`;

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${wsUrl}" track="inbound_track" />
  </Connect>
</Response>`;

  res.setHeader('Content-Type', 'text/xml');
  res.send(twiml);
});

// ── POST /webhooks/twilio/status ─────────────────────────────────────────────
// Twilio fires this on every call status change.
// We update call_logs and trigger brief generation on completion.

router.post('/status', async (req: Request, res: Response) => {
  const callSid = req.body.CallSid as string;
  const callStatus = req.body.CallStatus as string;
  const callDuration = req.body.CallDuration as string | undefined;

  logger.info('Twilio status webhook', { callSid, callStatus });

  try {
    if (callStatus === 'in-progress') {
      await supabaseAdmin
        .from('call_logs')
        .update({ outcome: 'answered' })
        .eq('call_sid', callSid);
    } else if (callStatus === 'completed') {
      const duration = callDuration ? parseInt(callDuration, 10) : 0;
      // Twilio AMD: AnsweredBy is 'human', 'unknown', 'machine_start',
      // 'machine_end_beep', 'machine_end_silence', 'machine_end_other', or 'fax'.
      const answeredBy = (req.body.AnsweredBy ?? '') as string;
      const isVoicemail = answeredBy.startsWith('machine') || answeredBy === 'fax';
      const outcome = isVoicemail ? 'voicemail' : 'answered';

      const { data: callLog } = await supabaseAdmin
        .from('call_logs')
        .update({ outcome, duration_seconds: duration })
        .eq('call_sid', callSid)
        .select('id')
        .single();

      if (callLog?.id && !isVoicemail) {
        // Fire-and-forget — don't make Twilio's status callback wait
        generateBrief(callLog.id)
          .then(() => deliverBrief(callLog.id))
          .catch(err =>
            logger.error('Brief pipeline failed', { callSid, callLogId: callLog.id, error: err })
          );
        logger.info('Call completed — brief pipeline started', { callSid, callLogId: callLog.id, outcome });
      }
    } else if (callStatus === 'no-answer' || callStatus === 'canceled') {
      await supabaseAdmin
        .from('call_logs')
        .update({ outcome: 'no_answer' })
        .eq('call_sid', callSid);
    } else if (callStatus === 'busy' || callStatus === 'failed') {
      await supabaseAdmin
        .from('call_logs')
        .update({ outcome: 'failed' })
        .eq('call_sid', callSid);
    }
  } catch (err) {
    logger.error('Failed to update call_logs on status change', { callSid, callStatus, error: err });
  }

  res.sendStatus(200);
});

export default router;
