import twilio from 'twilio';
import { config } from '../utils/config';
import { supabaseAdmin } from '../db/supabase';
import { getRecentMemory } from './memory-store';
import { getTodayTheme } from '../prompts/daily-themes';
import { buildCallSystemPrompt } from '../prompts/call-system-prompt';
import { pendingCalls } from './call-agent';
import { getSeniorLocalDate } from '../utils/timezone';
import { logger } from '../utils/logger';
import type { Senior } from '../db/types';

const twilioClient = twilio(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN);

/**
 * Orchestrates one outbound call to a senior.
 *
 * Steps:
 *  1. Load senior + last 5 memory entries from Supabase
 *  2. Get today's theme (timezone + memory_flag aware)
 *  3. Build the full call system prompt
 *  4. Create a call_logs row (outcome: 'pending')
 *  5. Place the Twilio outbound call
 *  6. Store prompt in the pendingCalls map so call-agent.ts can retrieve it when Twilio connects
 *
 * Returns the Twilio callSid.
 */
export async function initiateCall(seniorId: string): Promise<string> {
  // ── 1. Load senior ──────────────────────────────────────────────────────────
  const { data: senior, error: seniorErr } = await supabaseAdmin
    .from('seniors')
    .select('*')
    .eq('id', seniorId)
    .single();

  if (seniorErr || !senior) {
    throw new Error(`Senior not found: ${seniorId}${seniorErr ? ` — ${seniorErr.message}` : ''}`);
  }

  if (!senior.is_active) {
    throw new Error(`Senior ${seniorId} is not active — skipping call`);
  }

  // ── 2. Load last 5 memory entries ────────────────────────────────────────────
  const memoryEntries = await getRecentMemory(seniorId, 5);

  // ── 3. Today's theme (timezone-correct, Thursday/CAUTION aware) ───────────────
  const theme = getTodayTheme(senior.timezone, senior.memory_flag);

  // ── 4. Build system prompt ───────────────────────────────────────────────────
  const systemPrompt = buildCallSystemPrompt(senior as Senior, memoryEntries, theme);

  // ── 5. Create call_logs row ──────────────────────────────────────────────────
  const callDate = getSeniorLocalDate(new Date(), senior.timezone);

  const { data: callLog, error: callLogErr } = await supabaseAdmin
    .from('call_logs')
    .insert({
      senior_id: seniorId,
      call_sid: null,           // filled in once Twilio returns the callSid
      call_date: callDate,
      call_time_utc: new Date().toISOString(),
      outcome: 'pending',
      duration_seconds: 0,
      daily_theme: theme.name,
      transcript: null,
      mood_score: null,
      topics_mentioned: null,
      flags_detected: [],
      memory_update: null,
      brief_text: null,
      brief_delivered: false,
      brief_delivered_at: null,
      brief_delivery_channels: null,
    })
    .select('id')
    .single();

  if (callLogErr || !callLog) {
    throw new Error(`Failed to create call_log: ${callLogErr?.message}`);
  }

  const callLogId = callLog.id as string;

  const voiceWebhookUrl = `${config.APP_URL}/webhooks/twilio/voice`;
  const statusWebhookUrl = `${config.APP_URL}/webhooks/twilio/status`;

  logger.info('Initiating call', {
    seniorId,
    name: senior.preferred_name,
    callLogId,
    theme: theme.name,
    memoryCount: memoryEntries.length,
    voiceWebhookUrl,   // verify this appears in Twilio call debugger
  });

  // ── 6. Place the Twilio outbound call ────────────────────────────────────────
  // We embed TwiML inline rather than providing a webhook URL.
  // Reason: Twilio trial accounts (and some firewall setups) never make the
  // HTTP request to fetch TwiML, so the voice webhook was never reached.
  // Inline twiml bypasses that HTTP round-trip entirely.
  //
  // The WebSocket URL uses /ws/stream (no callSid in path) because the callSid
  // is only known AFTER calls.create() returns. The call-agent reads the real
  // callSid from Twilio's 'start' event message instead of the URL path.
  const wsHost = new URL(config.APP_URL).host;
  const wsStreamUrl = `wss://${wsHost}/ws/stream`;
  const inlineTwiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Connect><Stream url="${wsStreamUrl}" track="inbound_track" /></Connect></Response>`;

  logger.info('Placing Twilio call', {
    to: senior.phone,
    from: config.TWILIO_PHONE_NUMBER,
    wsStreamUrl,
    statusCallback: statusWebhookUrl,
  });

  let twilioCall;
  try {
    twilioCall = await twilioClient.calls.create({
      to: senior.phone,
      from: config.TWILIO_PHONE_NUMBER,
      twiml: inlineTwiml,
      statusCallback: statusWebhookUrl,
      statusCallbackMethod: 'POST',
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      machineDetection: 'Enable',
      machineDetectionTimeout: 30,
    });
  } catch (err) {
    // Twilio rejected the call — mark as failed so the scheduler doesn't retry endlessly
    await supabaseAdmin
      .from('call_logs')
      .update({ outcome: 'failed' })
      .eq('id', callLogId);
    throw err;
  }

  const callSid = twilioCall.sid;

  // ── 7. Update call_log with Twilio callSid ───────────────────────────────────
  await supabaseAdmin
    .from('call_logs')
    .update({ call_sid: callSid })
    .eq('id', callLogId);

  // ── 8. Register in pendingCalls — call-agent.ts reads this on WS 'start' ────
  pendingCalls.set(callSid, {
    systemPrompt,
    callLogId,
    seniorPreferredName: senior.preferred_name,
    companionName: senior.companion_name,
  });

  logger.info('Call placed', {
    callSid,
    name: senior.preferred_name,
    phone: senior.phone.slice(-4).padStart(senior.phone.length, '*'),   // mask for logs
    callLogId,
  });

  return callSid;
}
