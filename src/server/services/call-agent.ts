import { WebSocket } from 'ws';
import Anthropic from '@anthropic-ai/sdk';
import { config } from '../utils/config';
import { supabaseAdmin } from '../db/supabase';
import { DeepgramTranscriber } from './stt-service';
import { textToSpeech } from './tts-service';
import {
  twilioPayloadToBuffer,
  bufferToTwilioPayload,
  buildTwilioMediaMessage,
  buildTwilioMarkMessage,
  buildTwilioClearMessage,
  chunkBuffer,
} from '../utils/audio';
import { logger } from '../utils/logger';

// ── Shared state with call-engine.ts ────────────────────────────────────────

/** call-engine.ts populates this before placing the outbound Twilio call. */
export interface PendingCallData {
  systemPrompt: string;
  callLogId: string;
  seniorPreferredName: string;
  companionName: string;
}
export const pendingCalls = new Map<string, PendingCallData>();

// ── Per-call session ─────────────────────────────────────────────────────────

interface CallSession {
  callSid: string;
  streamSid: string;
  systemPrompt: string;
  callLogId: string;
  companionName: string;
  conversationHistory: { role: 'user' | 'assistant'; content: string }[];
  transcriber: DeepgramTranscriber;
  startTime: Date;
  isEnding: boolean;
  isSpeaking: boolean;
  fullTranscript: string[];
  hardCapTimer: ReturnType<typeof setTimeout> | null;
}

const activeCalls = new Map<string, CallSession>();

const anthropic = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });

// ── Filler buffers (pre-generated at first use) ──────────────────────────────

let fillerCache: Map<string, Buffer> | null = null;

async function getFillerBuffers(): Promise<Map<string, Buffer>> {
  if (fillerCache) return fillerCache;
  const map = new Map<string, Buffer>();
  const fillers: [string, string][] = [
    ['thinking', 'Mm, let me think about that for a moment...'],
    ['sorry', "Oh, I'm so sorry, I had a little trouble hearing that. Could you say that again?"],
    ['trouble', "I seem to be having a little trouble hearing you. I'll try calling again later!"],
    ['goodbye', "It's been such a lovely chat! I'll talk to you again soon. Have a beautiful day!"],
  ];
  for (const [key, text] of fillers) {
    try {
      map.set(key, await textToSpeech(text));
    } catch (err) {
      logger.warn(`Could not pre-generate filler "${key}"`, { error: err });
    }
  }
  fillerCache = map;
  return map;
}

// ── Audio helpers ────────────────────────────────────────────────────────────

function sendAudioToTwilio(ws: WebSocket, session: CallSession, audio: Buffer): void {
  for (const chunk of chunkBuffer(audio)) {
    ws.send(buildTwilioMediaMessage(session.streamSid, bufferToTwilioPayload(chunk)));
  }
}

// ── Session lifecycle ────────────────────────────────────────────────────────

async function endSession(ws: WebSocket, session: CallSession, reason: string): Promise<void> {
  if (session.isEnding) return;
  session.isEnding = true;

  if (session.hardCapTimer) {
    clearTimeout(session.hardCapTimer);
    session.hardCapTimer = null;
  }

  session.transcriber.stop();

  const transcript = session.fullTranscript.join('\n');
  const durationSeconds = Math.floor((Date.now() - session.startTime.getTime()) / 1000);

  try {
    if (session.callLogId) {
      await supabaseAdmin
        .from('call_logs')
        .update({ transcript, outcome: 'answered', duration_seconds: durationSeconds })
        .eq('id', session.callLogId);
    }
    logger.info('Call ended, transcript saved', { callSid: session.callSid, reason, turns: session.fullTranscript.length });
  } catch (err) {
    logger.error('Failed to save transcript on end', { callSid: session.callSid, error: err });
  }

  activeCalls.delete(session.callSid);

  try { ws.close(); } catch { /* already closed */ }
}

async function speakAndEnd(ws: WebSocket, session: CallSession, text: string): Promise<void> {
  try {
    const audio = await textToSpeech(text);
    sendAudioToTwilio(ws, session, audio);
    setTimeout(() => endSession(ws, session, 'forced'), 4000);
  } catch {
    await endSession(ws, session, 'forced');
  }
}

// ── AI turn pipeline ─────────────────────────────────────────────────────────

async function handleTranscript(
  ws: WebSocket,
  session: CallSession,
  text: string,
  fillers: Map<string, Buffer>,
): Promise<void> {
  // Barge-in: clear queued audio if Clara is mid-speech
  if (session.isSpeaking) {
    ws.send(buildTwilioClearMessage(session.streamSid));
    session.isSpeaking = false;
  }

  session.conversationHistory.push({ role: 'user', content: text });
  session.fullTranscript.push(`Senior: ${text}`);

  const elapsedMin = (Date.now() - session.startTime.getTime()) / 60000;

  if (elapsedMin > 6) {
    await speakAndEnd(ws, session, "It's been such a lovely chat! I'll talk to you again soon. Have a beautiful day!");
    return;
  }

  let systemPrompt = session.systemPrompt;
  if (elapsedMin > 5) {
    systemPrompt += '\n\n[WRAP UP] The conversation has been going for 5 minutes. Gently wrap up in the next response with warmth and end with [END_CALL] on its own line.';
  }

  // Call Claude (2s timeout)
  let responseText: string | null = null;
  try {
    const response = await Promise.race([
      anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 150,
        system: systemPrompt,
        messages: session.conversationHistory,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Claude timeout')), 2000)
      ),
    ]);
    responseText = response.content[0].type === 'text' ? response.content[0].text : '';
  } catch (err) {
    logger.warn('Claude timeout/error — playing filler', { callSid: session.callSid, error: (err as Error).message });
    const filler = fillers.get('thinking');
    if (filler) sendAudioToTwilio(ws, session, filler);
    return;
  }

  if (!responseText) return;

  const shouldEnd = responseText.includes('[END_CALL]');
  const cleanResponse = responseText.replace('[END_CALL]', '').trim();

  session.conversationHistory.push({ role: 'assistant', content: cleanResponse });
  session.fullTranscript.push(`${session.companionName}: ${cleanResponse}`);
  logger.info('Claude response', { callSid: session.callSid, preview: cleanResponse.slice(0, 80) });

  // TTS
  let audioBuffer: Buffer;
  try {
    audioBuffer = await textToSpeech(cleanResponse);
  } catch (err) {
    logger.error('ElevenLabs TTS failed — using filler', { callSid: session.callSid, error: err });
    const filler = fillers.get('sorry');
    audioBuffer = filler ?? Buffer.alloc(0);
    if (session.callLogId) {
      void supabaseAdmin.from('call_logs')
        .update({ flags_detected: ['tts_failure'] })
        .eq('id', session.callLogId);
    }
  }

  if (audioBuffer.length > 0) {
    session.isSpeaking = true;
    sendAudioToTwilio(ws, session, audioBuffer);
    ws.send(buildTwilioMarkMessage(session.streamSid, 'turn-complete'));
    logger.debug('TTS audio sent', { callSid: session.callSid, bytes: audioBuffer.length });
  }

  if (shouldEnd) {
    setTimeout(() => endSession(ws, session, 'natural'), 4000);
  }
}

// ── Entry point — called from index.ts WS upgrade handler ───────────────────

export function startCallAgent(ws: WebSocket, callSid: string): void {
  logger.info('WS upgrade received', { path: callSid === 'stream' ? '/ws/stream' : `/ws/call/${callSid}` });

  // Pre-load fillers in background; they'll be ready by the time speech arrives
  getFillerBuffers().catch(err => logger.warn('Filler pre-load failed', { error: err }));

  let session: CallSession | null = null;

  ws.on('message', (raw) => {
    void (async () => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }

      switch (msg.event as string) {
        case 'connected':
          break;

        case 'start': {
          const start = msg.start as { streamSid: string; callSid: string };
          const actualCallSid = start.callSid || callSid;
          const streamSid = start.streamSid;

          const pending = pendingCalls.get(actualCallSid);
          pendingCalls.delete(actualCallSid);

          let systemPrompt: string;
          let callLogId = '';
          let seniorPreferredName = '';
          let companionName = 'Clara';

          if (pending) {
            systemPrompt = pending.systemPrompt;
            callLogId = pending.callLogId;
            seniorPreferredName = pending.seniorPreferredName;
            companionName = pending.companionName;
          } else {
            // Dev fallback: look up call_log by call_sid if call-engine didn't populate the map
            logger.warn('No pending call data for callSid — using fallback', { callSid: actualCallSid });
            const { data: callLog } = await supabaseAdmin
              .from('call_logs')
              .select('id, senior_id')
              .eq('call_sid', actualCallSid)
              .single();
            callLogId = callLog?.id ?? '';
            systemPrompt = `You are ${companionName}, a warm and caring AI companion making a morning check-in call. Be gentle, curious, and uplifting. Keep responses short (1–3 sentences). When it's time to say goodbye, end warmly and include [END_CALL] on its own line.`;
          }

          const transcriber = new DeepgramTranscriber(actualCallSid);

          session = {
            callSid: actualCallSid,
            streamSid,
            systemPrompt,
            callLogId,
            companionName,
            conversationHistory: [],
            transcriber,
            startTime: new Date(),
            isEnding: false,
            isSpeaking: false,
            fullTranscript: [],
            hardCapTimer: null,
          };
          activeCalls.set(actualCallSid, session);

          const fillers = await getFillerBuffers();

          // Deepgram event handlers
          transcriber.onTranscript((text, isFinal) => {
            if (isFinal && text.trim() && session && !session.isEnding) {
              logger.info('Transcript [final]', { callSid: actualCallSid, text });
              handleTranscript(ws, session, text.trim(), fillers).catch(err =>
                logger.error('handleTranscript error', { callSid: actualCallSid, error: err })
              );
            }
          });

          transcriber.onError(async (err) => {
            logger.error('Deepgram disconnected mid-call', { callSid: actualCallSid, error: err.message });
            try {
              await transcriber.restart();
              logger.info('Deepgram reconnected', { callSid: actualCallSid });
            } catch {
              const filler = fillers.get('trouble') ?? Buffer.alloc(0);
              if (session && filler.length > 0) sendAudioToTwilio(ws, session, filler);
              if (session) setTimeout(() => endSession(ws, session!, 'deepgram-failure'), 4000);
            }
          });

          await transcriber.start();

          // Hard cap at 6 minutes
          session.hardCapTimer = setTimeout(async () => {
            if (session && !session.isEnding) {
              logger.warn('Hard cap reached — ending call', { callSid: actualCallSid });
              await speakAndEnd(ws, session, "It's been such a lovely chat! I'll talk to you again soon. Have a beautiful day!");
            }
          }, 6 * 60 * 1000);

          // Opening greeting
          const greeting = seniorPreferredName
            ? `Good morning, ${seniorPreferredName}! This is ${companionName} calling. I hope I've caught you at a good time — how are you doing today?`
            : `Good morning! This is ${companionName} calling. I hope I've caught you at a good time — how are you doing today?`;

          try {
            const greetingAudio = await textToSpeech(greeting);
            session.isSpeaking = true;
            sendAudioToTwilio(ws, session, greetingAudio);
            ws.send(buildTwilioMarkMessage(streamSid, 'greeting-complete'));
            session.fullTranscript.push(`${companionName}: ${greeting}`);
            session.conversationHistory.push({ role: 'assistant', content: greeting });
            logger.info('Greeting sent', { callSid: actualCallSid });
          } catch (err) {
            logger.error('Failed to play greeting', { callSid: actualCallSid, error: err });
          }

          logger.info('Media stream started', { callSid: actualCallSid, streamSid });
          break;
        }

        case 'media': {
          if (!session) return;
          const media = msg.media as { payload: string };
          session.transcriber.sendAudio(twilioPayloadToBuffer(media.payload));
          break;
        }

        case 'mark': {
          if (!session) return;
          const mark = msg.mark as { name: string };
          if (mark.name === 'turn-complete' || mark.name === 'greeting-complete') {
            session.isSpeaking = false;
          }
          break;
        }

        case 'stop': {
          if (session) await endSession(ws, session, 'completed');
          break;
        }
      }
    })();
  });

  ws.on('close', (code) => {
    void (async () => {
      if (session && !session.isEnding) {
        logger.warn('WebSocket closed unexpectedly', { callSid: session.callSid, code });
        if (session.hardCapTimer) clearTimeout(session.hardCapTimer);
        session.transcriber.stop();
        try {
          if (session.callLogId) {
            await supabaseAdmin.from('call_logs')
              .update({ transcript: session.fullTranscript.join('\n'), outcome: 'failed' })
              .eq('id', session.callLogId);
          }
        } catch (err) {
          logger.error('Failed to save transcript on unexpected close', { error: err });
        }
        activeCalls.delete(session.callSid);
      }
    })();
  });

  ws.on('error', (err) => {
    // 'close' fires after 'error' — cleanup happens there
    logger.error('WebSocket error', { callSid, error: err.message });
  });
}
