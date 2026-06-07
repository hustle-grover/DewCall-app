# Dewcall — Session-by-Session Build Plan

> **App:** Dewcall (AI morning call service for elderly parents)
> **Stack:** Node 20 + TypeScript monolith — `/src/server` (Express) + `/src/dashboard` (React + Vite + Tailwind)
> **Spec:** `Dewcall-PRD.md` is the source of truth. Read it fully before each session.
> **Rule:** Each session must end with the server running cleanly and its success criteria met before the next session begins.

---

## Overview

| # | Session | Deliverable |
|---|---------|-------------|
| 1 | Project Scaffold | Running Express server, env config, utils |
| 2 | Database Schema & Types | Schema applied to Supabase, TypeScript types, seed data |
| 3 | Prompts & Memory Store | All AI prompt files, memory read/write service |
| 4 | TTS & STT Services | ElevenLabs TTS + Deepgram STT working in isolation |
| 5 | Call Agent & Twilio Webhooks | Real-time AI conversation loop over Twilio Media Streams |
| 6 | Call Engine | Full orchestrated outbound call, transcript saved |
| 7 | Brief Generator & Flag Handler | Post-call brief + structured JSON from Claude |
| 8 | Brief Delivery | SMS, WhatsApp, Email delivery with retry |
| 9 | Call Scheduler | Cron scheduler with timezone-correct per-minute polling |
| 10 | REST API Routes | All dashboard-facing API endpoints |
| 11 | Stripe Billing | Checkout, customer portal, webhook, subscription lifecycle |
| 12 | Dashboard Foundation | React + Vite + Tailwind scaffold, login, signup, auth |
| 13 | Dashboard Onboarding | 7-step wizard, senior + family profile created in DB |
| 14 | Dashboard Home & History | Today's brief, brief timeline, all brief components |
| 15 | Dashboard Mood, Profile & Settings | Mood chart, edit parent profile, settings, billing page |
| 16 | Integration Testing & Launch Prep | End-to-end test all paths, deploy to Railway/Render |

---

## Session 1 — Project Scaffold

**Goal:** A running TypeScript Express server with config, logging, and utility layer. Everything compiles, nothing crashes.

### Files to Create

```
package.json
tsconfig.json
.env.example
.gitignore
src/server/index.ts
src/server/utils/config.ts
src/server/utils/logger.ts
src/server/utils/timezone.ts
```

### Dependencies to Install

**Runtime:**
```
express @types/express
typescript ts-node ts-node-dev
dotenv
winston
luxon @types/luxon
zod
cors @types/cors
helmet
```

**Dev:**
```
@types/node
@types/cors
```

### Key Implementation Notes

- `config.ts` — load and validate all env vars via Zod at startup. Export a typed `config` object. Crash immediately with a clear message if any required variable is missing. Variable list is in `Dewcall-PRD.md` §2.3.
- `logger.ts` — Winston with JSON format in production, pretty-print in dev.
- `timezone.ts` — export two helpers: `toSeniorLocalTime(utcDate, timezone)` and `isSeniorCallTime(senior, nowUtc)`. These are critical for the scheduler — get them right here. Use `luxon` not `moment`.
- `src/server/index.ts` — Express app with `GET /health` returning `{ status: 'ok', app: 'Dewcall' }`. Start scheduler import (commented out for now). Register `cors`, `helmet`, `express.json()`.
- `package.json` scripts: `dev` (ts-node-dev), `build` (tsc), `start` (node dist/server/index.js).
- `.env.example` — exact copy of §2.3, but with `APP_URL=https://dewcall.app` (not morningbrief).

### What to Test

```bash
npm run dev
curl http://localhost:3000/health
# → { "status": "ok", "app": "Dewcall" }
```

### Success Criteria

- [ ] Server starts without errors on `npm run dev`
- [ ] `GET /health` returns 200
- [ ] `npm run build` produces `dist/` with no TypeScript errors
- [ ] Starting with a missing required env var prints a clear error and exits

---

## Session 2 — Database Schema & TypeScript Types

**Goal:** Supabase schema applied, RLS working, typed DB client, and seed data for a test family + senior for use in all subsequent sessions.

### Files to Create

```
src/server/db/supabase.ts
src/server/db/schema.sql
src/server/db/seed.ts
src/server/db/types.ts
```

### Dependencies to Install

```
@supabase/supabase-js
```

### Key Implementation Notes

- `schema.sql` — exact copy of the schema from `Dewcall-PRD.md` §3.1. Do not modify the structure. Apply it to your Supabase project via the SQL editor or Supabase CLI.
- `supabase.ts` — export TWO clients: `supabaseAnon` (uses `SUPABASE_ANON_KEY`, for user-facing routes that must respect RLS) and `supabaseAdmin` (uses `SUPABASE_SERVICE_ROLE_KEY`, for the backend pipeline only — scheduler, brief writer, call engine). Never use `supabaseAdmin` in routes that handle user requests.
- `types.ts` — TypeScript interfaces for all 6 tables: `FamilyMember`, `Senior`, `FamilySeniorLink`, `CallLog`, `MemoryEntry`, `FlagEvent`. Keep enums in sync with DB CHECK constraints (e.g. `subscription_status: 'trial' | 'active' | 'past_due' | 'cancelled'`).
- `seed.ts` — insert one test family member (name: "Sarah Test", email: `test@dewcall.dev`, phone: your real mobile for testing), one test senior (name: "Maggie Test", preferred_name: "Maggie", phone: the senior's test phone number, hobbies: "gardening, bridge, reading mysteries", personality_notes: "Warm, chatty, loves to laugh"), and the `family_senior_links` row linking them. Include 3 sample `memory_entries` so the AI has something to reference from day one of testing.

### What to Test

```bash
npx ts-node src/server/db/seed.ts
# → Should log: "Seed complete. Family: Sarah Test, Senior: Maggie Test"

# In Supabase dashboard, verify:
# - All 6 tables created with correct columns
# - RLS enabled on all tables
# - Seed data visible in seniors table
```

### Success Criteria

- [ ] Schema applied with no SQL errors
- [ ] Seed script runs without errors and data is visible in Supabase
- [ ] RLS policies in place (verify: using anon key, you cannot read data without auth)
- [ ] `supabaseAdmin` can query `seniors` table from the server
- [ ] TypeScript types compile cleanly against the schema

---

## Session 3 — Prompts & Memory Store

**Goal:** All AI prompt files ready with variable injection, and a working memory service that reads/writes `memory_entries`.

### Files to Create

```
src/server/prompts/call-system-prompt.ts
src/server/prompts/brief-system-prompt.ts
src/server/prompts/daily-themes.ts
src/server/services/memory-store.ts
```

### Dependencies to Install

None new (uses Supabase client from Session 2).

### Key Implementation Notes

**`daily-themes.ts`**
- Copy the `DAILY_THEMES` object verbatim from `Dewcall-PRD.md` §7.3.
- Export a function `getTodayTheme(timezone: string, memoryFlag: string): Theme` that returns the correct theme for the senior's local day of the week. If it's Thursday AND `memoryFlag === 'CAUTION'`, return Wednesday's theme instead.

**`call-system-prompt.ts`**
- Export a function `buildCallSystemPrompt(senior: Senior, memoryEntries: MemoryEntry[], theme: Theme): string`.
- Template from `Dewcall-PRD.md` §7.1. Inject all `{placeholder}` values.
- `{memory_block}` — formatted as the example in §4.4.2: `"Memory from [date]: [summary]"` for each of the last 5 entries. If no memory yet, use: `"This is our first call. No previous memory."`.
- If senior age is null, omit the age reference gracefully.

**`brief-system-prompt.ts`**
- Export a function `buildBriefPrompt(senior: Senior, familyMembers: FamilyMember[], channel: string): string`.
- Template from `Dewcall-PRD.md` §7.2. Formats recipients as a comma-separated list with relationships.

**`memory-store.ts`**
- `getRecentMemory(seniorId: string, limit = 5): Promise<MemoryEntry[]>` — fetch last N entries ordered by `call_date DESC`.
- `saveMemoryEntry(entry: Omit<MemoryEntry, 'id' | 'created_at'>): Promise<void>` — insert new entry. After insert, call `pruneOldMemory(seniorId)`.
- `pruneOldMemory(seniorId: string): Promise<void>` — if count > 10, mark the oldest as archived. **Do not delete**. Add an `archived: boolean DEFAULT false` column if not in the schema — if it is missing, add a migration.

### What to Test

```bash
npx ts-node -e "
import { getTodayTheme } from './src/server/prompts/daily-themes';
import { getRecentMemory } from './src/server/services/memory-store';
import { buildCallSystemPrompt } from './src/server/prompts/call-system-prompt';

// Print today's theme for UTC-8 (PST)
console.log(getTodayTheme('America/Los_Angeles', 'NORMAL'));

// Print a built system prompt for the test senior
getRecentMemory('<seed-senior-id>').then(mem => {
  // build and print prompt
});
"
```

### Success Criteria

- [ ] `getTodayTheme` returns Wednesday's theme when it's Thursday and `memoryFlag = 'CAUTION'`
- [ ] `buildCallSystemPrompt` produces a prompt with all placeholders filled — no `{undefined}` or `{null}` in output
- [ ] `getRecentMemory` returns the 3 seed memory entries in descending date order
- [ ] Saving a 4th memory entry works; saving an 11th triggers prune and oldest is archived

---

## Session 4 — TTS & STT Services

**Goal:** Text-to-Speech (ElevenLabs) and Speech-to-Text (Deepgram) working as isolated services. These are the audio I/O layer for the call agent.

### Files to Create

```
src/server/services/tts-service.ts
src/server/services/stt-service.ts
```

### Dependencies to Install

```
elevenlabs
@deepgram/sdk
```

### Key Implementation Notes

**`tts-service.ts`**
- Primary: ElevenLabs. Export `textToSpeech(text: string): Promise<Buffer>` — returns raw MP3/audio buffer.
- Configure with `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID`.
- For the call flow, we need streaming TTS. Export a second function `textToSpeechStream(text: string): AsyncIterable<Buffer>` that streams audio chunks. This is what `call-agent.ts` will use for low latency.
- Fallback: if ElevenLabs fails, log a warning and throw — do not silently fail. Azure fallback can be added in a later session.
- Keep generated audio chunks in memory only (no disk writes). Privacy: no audio stored.

**`stt-service.ts`**
- Primary: Deepgram live transcription via WebSocket.
- Export a class `DeepgramTranscriber` with:
  - `start(): Promise<DeepgramLiveClient>` — opens a live transcription session
  - `onTranscript(callback: (text: string, isFinal: boolean) => void): void`
  - `sendAudio(chunk: Buffer): void`
  - `stop(): void`
- The transcriber is created once per call and torn down when the call ends.
- Only forward `isFinal: true` transcripts to the call agent — ignore interim results for now (reduces Claude API calls).

### What to Test

```bash
# TTS test — save a sample audio file to verify output
npx ts-node -e "
import { textToSpeech } from './src/server/services/tts-service';
import fs from 'fs';
textToSpeech('Good morning Maggie! This is Clara. How are you today?')
  .then(buf => { fs.writeFileSync('/tmp/tts-test.mp3', buf); console.log('Written to /tmp/tts-test.mp3'); });
"
# → Play /tmp/tts-test.mp3. Should sound warm and natural.

# STT test — a manual mic input test or a pre-recorded WAV file
```

### Success Criteria

- [ ] `textToSpeech('Hello Maggie')` returns a non-empty audio buffer
- [ ] The TTS audio sounds natural and warm (listen to it manually)
- [ ] `DeepgramTranscriber` connects without errors (check Deepgram dashboard for session)
- [ ] If `ELEVENLABS_API_KEY` is wrong, error is thrown with a useful message (not a silent failure)

---

## Session 5 — Call Agent & Twilio Webhooks

**Goal:** The complete real-time AI conversation loop over Twilio Media Streams, with a working audio utility layer, a correctly structured WebSocket handler, the exact Twilio → Deepgram → Claude → ElevenLabs → Twilio pipeline, and mid-call error handling for every service failure mode.

### Files to Create

```
src/server/utils/audio.ts           ← NEW: mulaw/PCM/base64 utilities
src/server/services/call-agent.ts
src/server/routes/webhooks.ts
src/server/routes/index.ts          (router aggregator)
```

### Dependencies to Install

```
twilio
ws @types/ws
mulaw
```

> `mulaw` is the correct npm package for mu-law encode/decode. Do not use `@datastream/mulaw` (does not exist). Note: for this pipeline you may not need it at all — see audio format notes below — but install it as a utility fallback.

---

### Part 1 — Audio Utility (`src/server/utils/audio.ts`)

Twilio and ElevenLabs use different audio formats. All format bridging lives here.

**Formats at each pipeline stage:**
| Stage | Format |
|-------|--------|
| Twilio → our server (inbound) | 8kHz, mu-law, base64-encoded, delivered in JSON `media.payload` |
| Our server → Deepgram | Raw mu-law bytes at 8kHz (Deepgram accepts natively — no decode needed) |
| Deepgram → our server | Plain text transcript |
| Our server → ElevenLabs | Plain text |
| ElevenLabs → our server | mu-law 8kHz (configure `output_format: 'ulaw_8000'` — no resampling needed) |
| Our server → Twilio (outbound) | mu-law 8kHz, base64-encoded, sent as Twilio media message |

**Key insight:** both Deepgram and ElevenLabs can work natively in mu-law 8kHz. Configure them correctly and you avoid all PCM conversion. The `audio.ts` utility handles only base64/buffer bridging and message construction.

**Export these functions:**

```typescript
// Decode Twilio's base64 payload into raw mulaw bytes for Deepgram
export function twilioPayloadToBuffer(base64Payload: string): Buffer

// Encode ElevenLabs mulaw buffer into base64 for Twilio
export function bufferToTwilioPayload(buffer: Buffer): string

// Build the JSON message to send audio back to the senior through Twilio's WS
// Twilio media messages sent back over the stream must include streamSid
export function buildTwilioMediaMessage(streamSid: string, base64Payload: string): string
// → '{"event":"media","streamSid":"MZ...","media":{"payload":"<base64>"}}'

// Build a Twilio mark message (used to detect when playback finishes)
export function buildTwilioMarkMessage(streamSid: string, label: string): string
// → '{"event":"mark","streamSid":"MZ...","mark":{"name":"<label>"}}'

// Build a Twilio clear message (interrupt/barge-in: stops currently playing audio)
export function buildTwilioClearMessage(streamSid: string): string
// → '{"event":"clear","streamSid":"MZ..."}'

// Split a large audio buffer into 8kB chunks for streaming
// (Twilio recommends chunked payloads for smooth playback)
export function chunkBuffer(buffer: Buffer, chunkSize = 8192): Buffer[]
```

---

### Part 2 — Twilio Webhook Routes (`src/server/routes/webhooks.ts`)

**`POST /webhooks/twilio/voice`** — called by Twilio when the senior's phone is answered:
```typescript
// Validate Twilio signature (see below)
// Extract CallSid from body
// Look up the pre-built system prompt from the in-memory Map (populated by call-engine.ts)
// Return TwiML to connect the Media Stream:
```
```xml
<Response>
  <Connect>
    <Stream url="wss://{{APP_URL}}/ws/call/{{callSid}}" track="inbound_track" />
  </Connect>
</Response>
```
Set `Content-Type: text/xml` on the response.

**`POST /webhooks/twilio/status`** — Twilio calls this on every call status change:
- Relevant `CallStatus` values: `ringing`, `in-progress`, `completed`, `no-answer`, `busy`, `failed`
- On `completed`: update `call_logs.outcome = 'answered'`, `duration_seconds`, then call `generateBrief(callLogId)` asynchronously (fire-and-forget — don't make Twilio wait)
- On `no-answer` / `busy` / `failed`: update `call_logs.outcome` accordingly. The scheduler handles retries — this webhook just records the outcome.
- On `in-progress`: update `call_logs.outcome = 'answered'` (call was picked up)

**Twilio signature validation** — apply to EVERY `/webhooks/twilio/*` route:
```typescript
import twilio from 'twilio';

function validateTwilioSignature(req: Request, res: Response, next: NextFunction) {
  const signature = req.headers['x-twilio-signature'] as string;
  const url = `${config.APP_URL}${req.originalUrl}`;
  const valid = twilio.validateRequest(
    config.TWILIO_AUTH_TOKEN,
    signature,
    url,
    req.body
  );
  if (!valid) return res.status(403).send('Forbidden');
  next();
}
```
Note: `req.body` must be the raw URL-encoded form body (not JSON-parsed) for validation to work. Use `express.urlencoded({ extended: false })` on webhook routes, not `express.json()`.

---

### Part 3 — WebSocket Server Setup (`src/server/index.ts` — update this session)

The `ws` library does not do path-based routing like Express. You must handle it on the HTTP `upgrade` event:

```typescript
import { WebSocketServer, WebSocket } from 'ws';
import { startCallAgent } from './services/call-agent';

const wss = new WebSocketServer({ noServer: true });

// Attach to the existing HTTP server (not the Express app directly)
const httpServer = app.listen(config.PORT);

httpServer.on('upgrade', (req, socket, head) => {
  const pathname = new URL(req.url!, `http://localhost`).pathname;
  const match = pathname.match(/^\/ws\/call\/([A-Za-z0-9]+)$/);
  if (match) {
    const callSid = match[1];
    wss.handleUpgrade(req, socket, head, (ws) => {
      startCallAgent(ws, callSid);
    });
  } else {
    socket.destroy(); // reject unrecognised WS paths
  }
});
```

---

### Part 4 — Call Agent (`src/server/services/call-agent.ts`)

**Twilio Media Streams message format** — every message Twilio sends over the WS is a JSON string. Parse it and handle by `event` field:

```typescript
ws.on('message', (raw: Buffer) => {
  const msg = JSON.parse(raw.toString());
  switch (msg.event) {
    case 'connected':
      // Twilio WS connected — no action needed
      break;
    case 'start':
      // Stream is starting. Capture streamSid here — you need it to send audio back.
      session.streamSid = msg.start.streamSid;
      session.callSid = msg.start.callSid;
      // Play the opening greeting immediately
      await playGreeting(session);
      break;
    case 'media':
      // Inbound audio chunk from the senior
      // msg.media.payload = base64-encoded mulaw 8kHz
      const audioChunk = twilioPayloadToBuffer(msg.media.payload);
      session.transcriber.sendAudio(audioChunk);
      break;
    case 'mark':
      // Twilio confirms a previously sent mark was reached (playback completed)
      session.onMarkReceived(msg.mark.name);
      break;
    case 'stop':
      // Call ended — clean up
      await session.end('completed');
      break;
  }
});
```

**`CallSession` class / object — track per-call state:**
```typescript
interface CallSession {
  callSid: string;
  streamSid: string;           // set on 'start' event
  systemPrompt: string;
  conversationHistory: { role: 'user' | 'assistant'; content: string }[];
  transcriber: DeepgramTranscriber;
  startTime: Date;
  isEnding: boolean;           // prevents double-close
  isSpeaking: boolean;         // true while TTS audio is playing
  fullTranscript: string[];    // accumulate for saving
}
```

**Complete pipeline — one AI turn:**
```
1. Deepgram fires onTranscript(text, isFinal=true)
2. If session.isSpeaking → send clearMessage (barge-in support)
3. Push { role: 'user', content: text } to conversationHistory
4. Append text to fullTranscript
5. Check call duration:
   - If > 5 min and not already ending: append wrap-up instruction to next Claude call
   - If > 6 min: call session.end('hard-cap') immediately
6. Call Claude:
   const response = await anthropic.messages.create({
     model: 'claude-haiku-4-5-20251001',
     max_tokens: 150,            // keep responses short for conversation
     system: session.systemPrompt,
     messages: session.conversationHistory,
   });
7. Extract text from response.content[0].text
8. Check if Claude signals end (look for agreed end-signal, e.g. response includes '[END_CALL]')
9. Push { role: 'assistant', content: responseText } to conversationHistory
10. Call ElevenLabs TTS:
    const audioBuffer = await textToSpeech(responseText);
    // textToSpeech configured with output_format: 'ulaw_8000'
11. Split buffer into chunks: chunkBuffer(audioBuffer)
12. For each chunk:
    const payload = bufferToTwilioPayload(chunk);
    ws.send(buildTwilioMediaMessage(session.streamSid, payload));
13. Send a mark message after the last chunk:
    ws.send(buildTwilioMarkMessage(session.streamSid, 'turn-complete'));
14. Set session.isSpeaking = true; clear on mark receipt
15. If Claude signalled end: after mark received, call session.end('natural')
```

**`session.end(reason)` — teardown sequence:**
```typescript
async function endSession(session: CallSession, reason: string) {
  if (session.isEnding) return;  // prevent double-close
  session.isEnding = true;

  // Stop Deepgram (no more audio needed)
  session.transcriber.stop();

  // Save transcript to call_logs
  const transcript = session.fullTranscript.join('\n');
  await supabaseAdmin
    .from('call_logs')
    .update({ transcript, outcome: 'answered' })
    .eq('call_sid', session.callSid);

  // Remove from active calls map
  activeCalls.delete(session.callSid);

  // Close the WebSocket (Twilio will hang up)
  ws.close();
}
```

---

### Part 5 — Error Handling for Every Service Failure Mid-Call

Wrap the pipeline in try/catch at each step. **Never let one call's failure crash the server.**

**If Deepgram disconnects mid-call:**
```typescript
transcriber.on('error', async (err) => {
  logger.error({ callSid, err }, 'Deepgram disconnected mid-call');
  // Attempt one reconnect within 3 seconds
  try {
    await session.transcriber.restart();
    logger.info({ callSid }, 'Deepgram reconnected');
  } catch {
    // Reconnect failed — gracefully end the call
    await speakAndEnd(session,
      "I seem to be having a little trouble hearing you. I'll try calling again later!"
    );
  }
});
```

**If Claude API errors or exceeds 2-second timeout:**
```typescript
const claudeResponse = await Promise.race([
  callClaude(session),
  new Promise<null>((_, reject) =>
    setTimeout(() => reject(new Error('Claude timeout')), 2000)
  )
]).catch(async (err) => {
  logger.warn({ callSid, err }, 'Claude timeout/error — using filler');
  // Play a filler phrase to prevent dead air
  await playFiller(session); // pre-generated mulaw buffer, loaded at startup
  return null; // null = skip this turn, wait for next transcript
});
```
Pre-generate 2–3 short filler phrases at server startup (e.g. "Mm, let me think about that for a moment...") using `textToSpeech` and cache the resulting mulaw buffers in memory. These are used as fallbacks without hitting ElevenLabs.

**If ElevenLabs fails or is slow:**
```typescript
try {
  audioBuffer = await textToSpeech(responseText);
} catch (err) {
  logger.error({ callSid, err }, 'ElevenLabs TTS failed');
  // Use a pre-cached filler and mark the call for review
  audioBuffer = session.fillerBuffers.get('sorry');
  await supabaseAdmin.from('call_logs')
    .update({ flags_detected: ['tts_failure'] })
    .eq('call_sid', callSid);
}
```

**If the WebSocket drops unexpectedly:**
```typescript
ws.on('close', async (code, reason) => {
  if (!session.isEnding) {
    logger.warn({ callSid, code }, 'WebSocket closed unexpectedly');
    session.transcriber.stop();
    // Save whatever transcript we have
    await supabaseAdmin.from('call_logs')
      .update({
        transcript: session.fullTranscript.join('\n'),
        outcome: 'failed'
      })
      .eq('call_sid', session.callSid);
    activeCalls.delete(session.callSid);
  }
});

ws.on('error', (err) => {
  logger.error({ callSid, err }, 'WebSocket error');
  // 'close' will fire after 'error', so cleanup happens there
});
```

**If the call exceeds 6 minutes (hard cap):**
```typescript
const hardCapTimer = setTimeout(async () => {
  logger.warn({ callSid }, 'Hard cap reached — ending call');
  await speakAndEnd(session,
    "It's been such a lovely chat! I'll talk to you again soon. Have a beautiful day!"
  );
}, 6 * 60 * 1000);

// Clear this timer in session.end() so it doesn't fire after natural close
```

**`speakAndEnd(session, text)` — utility used by all error paths:**
```typescript
async function speakAndEnd(session: CallSession, closingText: string) {
  try {
    const audio = await textToSpeech(closingText);
    sendAudioToTwilio(session, audio);
    // Short delay to let audio finish, then end
    setTimeout(() => session.end('forced'), 4000);
  } catch {
    session.end('forced'); // if TTS also fails, just close
  }
}
```

---

### What to Test

Use `ngrok` to expose your local server and trigger a test call:

```bash
# Terminal 1
ngrok http 3000

# In Twilio console: set voice webhook URL to https://<ngrok>.ngrok.io/webhooks/twilio/voice
# Trigger a test call from Twilio console

# Watch for these log lines in order:
# 1. "POST /webhooks/twilio/voice 200" — webhook hit, TwiML returned
# 2. "WS upgrade: /ws/call/CA..." — WebSocket connected
# 3. "Media stream started, streamSid: MZ..." — start event received
# 4. "Greeting sent" — opening TTS played
# 5. "Transcript [final]: <what senior said>" — Deepgram working
# 6. "Claude response: <text>" — Claude turn working
# 7. "TTS audio sent: <N> bytes" — ElevenLabs + audio back to Twilio
# 8. "Call ended, transcript saved" — on hang up
```

**Test error paths:**
```bash
# Simulate Claude timeout: temporarily point model to a fake endpoint
# → Expect filler phrase to play and "Claude timeout" in logs

# Simulate ElevenLabs failure: set a bad ELEVENLABS_API_KEY mid-run
# → Expect filler buffer used, call continues

# Simulate barge-in: talk while Clara is speaking
# → Expect clear message sent, Clara stops, transcript logged
```

### Success Criteria

- [ ] `audio.ts` functions compile and produce correct output (write a short unit test: `base64 → buffer → base64` round-trip)
- [ ] Twilio webhook signature validation rejects invalid signatures with 403
- [ ] WebSocket server correctly routes `/ws/call/:callSid` — logs `callSid` on connect
- [ ] Twilio `start` event's `streamSid` is captured and used for all outbound messages
- [ ] The AI greets the senior with their preferred name on the opening `start` event
- [ ] Speaking into the phone produces a logged final transcript (Deepgram working)
- [ ] Claude's response is spoken back through TTS — full round trip working, latency < 2s
- [ ] Barge-in: talking while Clara speaks sends a `clear` message and interrupts playback
- [ ] If Claude times out: filler phrase plays, no dead air, call continues
- [ ] If WebSocket drops unexpectedly: partial transcript is saved to `call_logs` with `outcome: 'failed'`
- [ ] Hard cap at 6 minutes: Clara delivers a warm closing line and the call ends cleanly
- [ ] After a completed call: transcript saved to `call_logs` in Supabase with correct content

---

## Session 6 — Call Engine

**Goal:** The call orchestrator — loads senior context, builds the prompt, initiates the Twilio outbound call, and coordinates the whole session lifecycle.

### Files to Create

```
src/server/services/call-engine.ts
scripts/test-call.ts
scripts/setup-twilio.ts
```

### Dependencies to Install

None new (Twilio SDK from Session 5).

### Key Implementation Notes

**`call-engine.ts`** — export `initiateCall(seniorId: string): Promise<void>`:
1. Load senior from Supabase (using `supabaseAdmin`)
2. Load last 5 `memory_entries` via `memory-store.ts`
3. Get today's theme via `getTodayTheme(senior.timezone, senior.memory_flag)`
4. Build system prompt via `buildCallSystemPrompt()`
5. Create a `call_logs` row with `outcome: 'pending'` (update it as the call progresses)
6. Initiate Twilio outbound call:
   ```typescript
   twilioClient.calls.create({
     to: senior.phone,
     from: config.TWILIO_PHONE_NUMBER,
     url: `${config.APP_URL}/webhooks/twilio/voice`,
     statusCallback: `${config.APP_URL}/webhooks/twilio/status`,
     statusCallbackMethod: 'POST',
     machineDetection: 'DetectMessageEnd', // for voicemail detection
   })
   ```
7. Store `callSid` in the `call_logs` row
8. Store system prompt in a temporary in-memory `Map<callSid, systemPrompt>` so the webhook can retrieve it

**No-answer handling:** The call engine does NOT implement the retry itself — that is the scheduler's job. The engine just initiates one call and records the outcome. The webhook's status callback updates `call_logs.outcome` to `no_answer` or `answered`.

**`setup-twilio.ts`** — one-time script:
- Verify the Twilio account is active
- List available phone numbers
- Print confirmation that the phone number in config is active and voice-capable

**`test-call.ts`** — dev script:
```typescript
// Usage: npx ts-node scripts/test-call.ts <senior-id>
// Triggers a real call to the senior's phone using the full pipeline
```

### What to Test

```bash
npx ts-node scripts/test-call.ts <seed-senior-id>
# → Maggie's phone should ring
# → Clara greets Maggie warmly with her name
# → Conversation works (2-3 exchanges)
# → Call ends, transcript appears in Supabase call_logs
```

### Success Criteria

- [ ] `test-call.ts` places a real call to the test senior's phone
- [ ] The AI greets with the senior's preferred name
- [ ] References at least one of the 3 seed memory entries (check the opening line)
- [ ] Transcript is saved to `call_logs` with `outcome: 'answered'`
- [ ] Call duration is recorded in `call_logs.duration_seconds`
- [ ] If the call goes to voicemail, `outcome` is set to `'voicemail'`

---

## Session 7 — Brief Generator & Flag Handler

**Goal:** After a call completes, Claude produces the family brief + structured metadata. Flags are escalated into `flag_events`. Test script works without a real call.

### Files to Create

```
src/server/services/brief-generator.ts
src/server/services/flag-handler.ts
scripts/test-brief.ts
```

### Dependencies to Install

```
@anthropic-ai/sdk
```

(Note: Use `claude-sonnet-4-6` for brief generation — quality over speed here.)

### Key Implementation Notes

**`brief-generator.ts`** — export `generateBrief(callLogId: string): Promise<BriefResult>`:
1. Load the `call_logs` row (which has the transcript)
2. Load the senior and linked family members
3. Build the brief prompt via `buildBriefPrompt()`
4. Call Claude with the transcript. The prompt from `Dewcall-PRD.md` §7.2 asks Claude to return:
   - The human-readable brief text (plain text/emoji format)
   - A JSON block: `{ memory_update, mood_score, topics_mentioned, flags_detected }`
5. Parse the response — extract the brief text and the JSON separately. The JSON follows a fixed marker in the response. Use `JSON.parse()` on the extracted block; if parse fails, retry once.
6. Update `call_logs` with: `brief_text`, `mood_score`, `topics_mentioned`, `flags_detected`, `memory_update`
7. Save a new `memory_entries` row via `memory-store.ts`
8. Return the `BriefResult` for downstream delivery

**`flag-handler.ts`** — export `processFlags(callLogId: string, flags: DetectedFlag[]): Promise<void>`:
1. For each flag in `flags_detected`:
   - Insert into `flag_events` table
   - Set `severity` from the flag data (low / medium / high / urgent)
2. Return the list of flags that require urgent notification (severity: 'urgent' or category: 'safety' | 'physical')
3. The actual urgent SMS is sent by `brief-delivery.ts` — this service just persists and classifies.

**`test-brief.ts`** — script with a hardcoded sample transcript (happy-path and flag scenarios):
```typescript
// Sample transcript showing a warm conversation where Maggie mentions:
// - Her tomatoes are growing
// - Knee is feeling better
// - A neighbour called about her bank account (safety flag)
// Run: npx ts-node scripts/test-brief.ts
// Expected: brief text + JSON with a safety flag detected
```

### What to Test

```bash
npx ts-node scripts/test-brief.ts
# Print:
# === BRIEF TEXT ===
# Good morning Sarah! Here's Maggie's update...
# === METADATA ===
# { mood_score: 4, topics: [...], flags: [...] }
```

Also verify the trigger from a real call: after running `test-call.ts` (Session 6), the webhook's status callback should auto-trigger `generateBrief`.

### Success Criteria

- [ ] `test-brief.ts` produces a warm, readable brief (not clinical language)
- [ ] The brief is < 600 chars for SMS (verify character count)
- [ ] The `flags_detected` JSON correctly identifies the safety flag in the sample transcript
- [ ] `mood_score` is a number 1–5
- [ ] `memory_update` is 2–3 sentences, would be useful context for the next call
- [ ] Running on the real call log from Session 6 saves the brief to `call_logs.brief_text` in Supabase

---

## Session 8 — Brief Delivery

**Goal:** Briefs reach family members via SMS, WhatsApp, and email. Retry on failure. Urgent flags fire immediately on a separate SMS.

### Files to Create

```
src/server/services/brief-delivery.ts
```

### Dependencies to Install

```
resend
```

(Twilio already installed for SMS/WhatsApp)

### Key Implementation Notes

**`brief-delivery.ts`** — export `deliverBrief(callLogId: string): Promise<void>`:

1. Load the `call_logs` row (needs `brief_text`, `flags_detected`, `senior_id`)
2. Load the senior and all linked family members with `receives_briefs = true`
3. For each family member, determine their channel (`preferred_brief_channel`): `'sms' | 'whatsapp' | 'email' | 'all'`
4. Send via appropriate channel(s). If `'all'`, send all three.
5. **SMS delivery** via Twilio:
   ```typescript
   twilioClient.messages.create({
     to: familyMember.phone,
     from: config.TWILIO_PHONE_NUMBER,
     body: briefText
   })
   ```
6. **WhatsApp delivery** via Twilio:
   - `to: 'whatsapp:+1...'`, `from: 'whatsapp:+1...'` (using `TWILIO_WHATSAPP_NUMBER`)
7. **Email delivery** via Resend:
   - Subject: `"[Senior's name]'s Morning — [Day Date] ☀️"`
   - Body: longer email format (the brief text plus a footer "Sent by Dewcall")
   - Use Resend's SDK: `resend.emails.send({from: 'briefs@dewcall.app', to, subject, text})`
8. **Retry logic:** wrap each send in a retry loop — 3 attempts, exponential backoff (2s, 4s, 8s). If all 3 fail, log error and mark in `call_logs.brief_delivery_channels` as failed.
9. On success: update `call_logs` with `brief_delivered: true`, `brief_delivered_at: NOW()`, `brief_delivery_channels: [...]`

**No-answer notification:** Export a separate `sendNoAnswerNotification(seniorId: string): Promise<void>`:
- Sends to all linked family members with `receives_flags = true`
- Text: `"[Name] didn't answer their morning call today. You may want to check in. 💛"`

**Urgent flag SMS:** Export `sendUrgentFlagNotification(seniorId: string, flag: DetectedFlag): Promise<void>`:
- Always sends via SMS regardless of preferred channel
- Prepend `⚠️` flag text before the brief

### What to Test

```bash
# After running test-brief.ts (Session 7), trigger delivery:
npx ts-node -e "
import { deliverBrief } from './src/server/services/brief-delivery';
deliverBrief('<call-log-id-from-session-7>');
"
# → Your phone should receive the brief within 60 seconds
```

### Success Criteria

- [ ] SMS arrives on test family member's phone within 60 seconds
- [ ] SMS content matches the brief text (warm tone, emoji, under 600 chars)
- [ ] Email arrives with correct subject line and longer-form content
- [ ] WhatsApp message arrives (requires Twilio sandbox approval — test in sandbox)
- [ ] Retry logic: simulate a failure (wrong phone number) and confirm 3 attempts are logged before giving up
- [ ] `call_logs.brief_delivered` flips to `true` in Supabase after delivery

---

## Session 9 — Call Scheduler

**Goal:** The cron engine that runs every minute, checks which seniors need a call right now (in their timezone), triggers calls, and handles the no-answer retry loop.

### Files to Create

```
src/server/services/call-scheduler.ts
```

### Dependencies to Install

```
node-cron
```

### Key Implementation Notes

**`call-scheduler.ts`** — the core scheduler logic:

**Main cron (every minute):**
```typescript
cron.schedule('* * * * *', async () => {
  const nowUtc = new Date();
  const seniors = await getSeniorsScheduledForNow(nowUtc);
  for (const senior of seniors) {
    await initiateCall(senior.id); // from call-engine.ts
  }
});
```

**`getSeniorsScheduledForNow(nowUtc: Date)`:**
1. Query `seniors` where `is_active = true`
2. For each, convert `nowUtc` to the senior's timezone using `luxon`
3. Compare `senior.call_time` (e.g. `09:00`) with current local time — match if within the same minute (HH:MM)
4. Check `call_frequency` against today's local day:
   - `'daily'` → always
   - `'weekdays'` → Monday–Friday only
   - `'every_2_days'` → check if `daysSinceLastCall >= 2`
   - `'3x_week'` → Monday, Wednesday, Friday
   - `'custom'` → check `custom_call_days` array (e.g. `['monday', 'thursday']`)
5. Also check: has a call already been logged for this senior today (in their local timezone)? If yes, skip.

**Retry cron (every minute, separate check):**
- Query `call_logs` where `outcome = 'no_answer'` AND `created_at` is between 14 and 16 minutes ago AND no retry has been attempted
- For each, call `initiateCall()` again, mark the original call log with a `retry_attempted = true` flag
- If this retry also gets `no_answer`, call `sendNoAnswerNotification()` from brief-delivery.ts

**Integrate into `src/server/index.ts`:** import and start the scheduler on server boot. Log: `"Scheduler started. Watching for calls every minute."`

### What to Test

```typescript
// Unit-test getSeniorsScheduledForNow with mocked data:
// - Senior in PST with call_time 09:00 → should trigger when UTC = 17:00
// - Senior in EST with call_time 09:00 → should trigger when UTC = 14:00
// - weekdays-only senior should NOT trigger on Saturday
// - A senior who already had a call today should NOT trigger again
```

### Success Criteria

- [ ] `getSeniorsScheduledForNow` correctly returns a PST senior at UTC 17:00 (9am PST)
- [ ] A weekdays-only senior does NOT appear in the list on a Saturday
- [ ] A senior who already has a `call_logs` row for today (their local date) is not called again
- [ ] Scheduler logs `"No seniors to call at [time]"` when nothing is scheduled
- [ ] No-answer retry triggers ~15 min after first no-answer (test with a number you won't pick up)

---

## Session 10 — REST API Routes

**Goal:** All dashboard-facing API endpoints working and auth-protected. The React dashboard can read and write all data through these routes.

### Files to Create

```
src/server/routes/api.ts
src/server/routes/auth.ts
src/server/middleware/auth.ts
src/server/routes/index.ts  (update to include all routes)
```

### Dependencies to Install

None new.

### Key Implementation Notes

**`middleware/auth.ts`** — `requireAuth` middleware:
- Extract JWT from `Authorization: Bearer <token>` header
- Verify with Supabase: `supabaseAnon.auth.getUser(token)`
- Attach `req.user` and `req.familyMemberId` to the request
- Return 401 if invalid

**`routes/auth.ts`** — thin wrapper (Supabase handles the actual auth):
- `POST /api/auth/signup` → `supabaseAnon.auth.signUp()`, then create a `family_members` row
- `POST /api/auth/login` → `supabaseAnon.auth.signInWithPassword()`, return session token
- `POST /api/auth/logout` → `supabaseAnon.auth.signOut()`
- `GET /api/auth/me` → return current `family_members` row for the authenticated user

**`routes/api.ts`** — all endpoints from `Dewcall-PRD.md` §5.1:
- All routes except `/webhooks/*` and `/api/billing/*` require `requireAuth`
- Use `supabaseAnon` (with the user's JWT) for data reads — **never `supabaseAdmin`** — so RLS applies
- Use `supabaseAdmin` only for the onboarding `POST /api/onboarding/complete` which creates the first `family_senior_links` row (before RLS would permit it)
- Admin routes (`/api/admin/*`) check for an `ADMIN_SECRET` header
- Include `POST /api/admin/test-call/:seniorId` which calls `initiateCall(seniorId)` directly

**Key endpoint logic:**
- `GET /api/briefs/:seniorId/mood` — aggregate query returning `[{date, mood_score}]` for last 30 days
- `PUT /api/flags/:id/acknowledge` — set `acknowledged_by` to current user id, `acknowledged_at` to now
- `POST /api/family/invite` — for now: just create a `family_senior_links` row with the invitee's email; actual invite email via Resend can be added later
- `POST /api/onboarding/complete` — marks senior `onboarding_completed = true` and logs the first scheduled call time

### What to Test

Use a REST client (Postman or curl) to hit each endpoint:
```bash
# Signup
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@dewcall.dev","password":"Test1234!"}'

# Login and get token
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@dewcall.dev","password":"Test1234!"}' | jq -r '.token')

# List seniors
curl http://localhost:3000/api/seniors \
  -H "Authorization: Bearer $TOKEN"

# Trigger test call (admin)
curl -X POST http://localhost:3000/api/admin/test-call/<senior-id> \
  -H "X-Admin-Secret: $ADMIN_SECRET"
```

### Success Criteria

- [ ] Signup creates both a Supabase auth user and a `family_members` row
- [ ] Login returns a valid JWT that works for all subsequent requests
- [ ] `GET /api/seniors` returns only seniors linked to the authenticated user (RLS working)
- [ ] An unauthenticated request to any `/api/*` route returns 401
- [ ] `GET /api/briefs/:seniorId` returns paginated briefs sorted newest-first
- [ ] `GET /api/briefs/:seniorId/mood` returns the mood chart data array
- [ ] `POST /api/admin/test-call/:seniorId` triggers a real call (from Session 6)

---

## Session 11 — Stripe Billing

**Goal:** The complete subscription lifecycle — trial start, checkout, active subscription, webhook handling, customer portal, and cancellation.

### Files to Create

```
src/server/routes/stripe.ts
```

### Dependencies to Install

```
stripe
```

### Key Implementation Notes

**Stripe setup (before coding):**
- Create a Stripe product: "Dewcall" with a monthly price of $25 (`STRIPE_PRICE_ID`)
- Set up a webhook in the Stripe dashboard pointing to `POST /api/billing/webhook`
- Events to handle: `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.deleted`

**`routes/stripe.ts`:**

- `POST /api/billing/create-checkout` — create a Stripe Checkout Session:
  ```typescript
  stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    customer_email: familyMember.email,
    line_items: [{ price: config.STRIPE_PRICE_ID, quantity: 1 }],
    success_url: `${config.APP_URL}/billing?success=true`,
    cancel_url: `${config.APP_URL}/billing?cancelled=true`,
    trial_period_days: 7,  // 7-day free trial
    subscription_data: { metadata: { family_member_id: req.familyMemberId } },
  })
  ```
  Return the `url` to redirect the client.

- `POST /api/billing/portal` — create Stripe Customer Portal URL for managing/cancelling.

- `POST /api/billing/webhook` — **no auth middleware** (Stripe signs these itself):
  - Verify signature with `stripe.webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET)`
  - `checkout.session.completed` → save `stripe_customer_id` + `stripe_subscription_id` to `family_members`; set `subscription_status: 'active'`
  - `invoice.paid` → ensure `subscription_status: 'active'`
  - `invoice.payment_failed` → set `subscription_status: 'past_due'`; notify family via email
  - `customer.subscription.deleted` → set `subscription_status: 'cancelled'`; set all linked seniors `is_active: false`

**Trial handling:** Seniors created during the 7-day trial are `is_active: true` from day 1 — the scheduler will call them. If trial ends without subscription, the webhook sets `is_active: false` and calls stop.

### What to Test

Use Stripe's test mode + Stripe CLI to replay webhook events:
```bash
stripe listen --forward-to localhost:3000/api/billing/webhook

# Trigger test events
stripe trigger checkout.session.completed
stripe trigger invoice.payment_failed
```

### Success Criteria

- [ ] `POST /api/billing/create-checkout` returns a valid Stripe Checkout URL
- [ ] Completing checkout (in test mode) fires the webhook and updates `family_members.subscription_status` to `'active'`
- [ ] `invoice.payment_failed` sets status to `'past_due'`
- [ ] `customer.subscription.deleted` sets status to `'cancelled'` and flips senior `is_active` to `false`
- [ ] Webhook rejects invalid Stripe signatures with 400
- [ ] Customer portal URL works and opens the Stripe portal

---

## Session 12 — Dashboard Foundation

**Goal:** The React + Vite + Tailwind frontend is scaffolded, styled with Dewcall's warm color palette, and the login/signup flow works end-to-end with Supabase Auth.

### Files to Create

```
src/dashboard/index.html
src/dashboard/vite.config.ts
src/dashboard/tailwind.config.ts
src/dashboard/postcss.config.js
src/dashboard/tsconfig.json
src/dashboard/src/main.tsx
src/dashboard/src/App.tsx
src/dashboard/src/lib/supabase.ts
src/dashboard/src/lib/api.ts
src/dashboard/src/pages/Login.tsx
src/dashboard/src/pages/Signup.tsx
src/dashboard/src/components/NavBar.tsx
```

### Dependencies to Install

```
react react-dom
@vitejs/plugin-react vite
tailwindcss autoprefixer postcss
react-router-dom
@supabase/supabase-js
@supabase/auth-helpers-react
react-hook-form
zod @hookform/resolvers
```

### Key Implementation Notes

**Color palette** (from `Dewcall-PRD.md` §4.5.2 — non-negotiable):
```typescript
// tailwind.config.ts — extend with Dewcall palette
colors: {
  dewcall: {
    cream: '#FAF7F2',       // background
    blue: '#5B8DB8',        // primary
    'blue-light': '#E8F0F7',
    sage: '#7A9E7E',        // success/positive
    amber: '#E8A838',       // alerts/warnings
    'amber-light': '#FEF3DC',
    warm: '#6B5B45',        // text
  }
}
```
Body font: Inter (import from Google Fonts). Minimum 16px body text. Mobile-first.

**`lib/api.ts`** — typed fetch wrapper that attaches the Supabase JWT to every request:
```typescript
export async function apiRequest<T>(path: string, options?: RequestInit): Promise<T>
```

**Auth flow:**
- `App.tsx` — wraps routes in Supabase `SessionContextProvider`. Protected routes redirect to `/login` if no session.
- After signup → redirect to `/onboarding`
- After login → redirect to `/` (home/brief)
- Login page: email + password form. Warm copy, not a generic auth form.
- Signup page: email + password only (name/phone collected in onboarding).

**Empty states** (the dashboard will have no data yet for most sessions — design them warmly):
- Home when no brief: `"Your first brief will arrive after [Name]'s first morning call ☀️"`
- History when empty: `"No briefs yet. Calls will appear here each morning."`

### What to Test

```bash
cd src/dashboard
npm run dev
# Open http://localhost:5173
# → Sign up with test@dewcall.dev
# → Should redirect to /onboarding (page can be a stub for now)
```

### Success Criteria

- [ ] Vite dev server starts without errors
- [ ] Login page renders with Dewcall colors — warm cream background, not clinical white
- [ ] Signup creates a user in Supabase Auth (verify in Supabase dashboard)
- [ ] After signup, user is redirected (to `/onboarding` stub is fine for now)
- [ ] After login, user is redirected to home
- [ ] Unauthenticated access to `/` redirects to `/login`
- [ ] Page is mobile-responsive (check at 375px width)
- [ ] `npm run build` succeeds with no TypeScript errors

---

## Session 13 — Dashboard Onboarding

**Goal:** The 7-step onboarding wizard that creates the family member profile, senior profile, and sets call preferences. Completing it triggers the first call schedule.

### Files to Create

```
src/dashboard/src/pages/Onboarding.tsx
```

### Key Implementation Notes

**7-step wizard structure** (from `Dewcall-PRD.md` §4.5.1):

| Step | What it collects | API call |
|------|-----------------|----------|
| 1 | Family member: name, phone, WhatsApp, timezone | `POST /api/onboarding/family` |
| 2 | Senior: name, preferred name, age, phone, relationship status, living situation | — |
| 3 | Senior personality: hobbies, personality notes, cultural notes, health notes | — |
| 4 | Call setup: call time, call frequency, companion name | `POST /api/onboarding/senior` |
| 5 | Brief channel: SMS / WhatsApp / Email / All | — |
| 6 | Invite family (optional, skippable) | — |
| 7 | Confirm + start trial | `POST /api/onboarding/complete` |

**UX notes:**
- Each step has a progress indicator (Step 2 of 7)
- Steps 3 and 6 should be clearly marked as optional with a "Skip for now" link
- Companion name defaults to "Clara" with a note: "This is what your parent will hear calling them"
- Step 7 shows a warm confirmation: "Clara will call [Name] at [time] starting tomorrow morning ☀️"
- No credit card on the trial confirmation — just a "Start 7-day free trial" button

**After `POST /api/onboarding/complete`:**
- Redirect to `/` (the daily brief home page, will be empty with warm empty state)

### What to Test

Walk through all 7 steps fully:
```
Open http://localhost:5173/onboarding
→ Complete all 7 steps
→ Check Supabase: family_members row updated, seniors row created, family_senior_links created
→ Check that senior.onboarding_completed = true
→ Redirected to home with warm empty state
```

### Success Criteria

- [ ] All 7 steps render correctly on mobile
- [ ] Skipping Step 3 doesn't break submission (hobbies etc. remain null)
- [ ] Skipping Step 6 doesn't break submission
- [ ] Completing Step 7 creates the senior in Supabase with all entered data
- [ ] After onboarding, `GET /api/seniors` returns the new senior
- [ ] The companion name field shows "Clara" as default
- [ ] Warm confirmation message shows the senior's name and call time correctly

---

## Session 14 — Dashboard Home & Brief History

**Goal:** The two most-used screens — today's brief (the daily home page) and the scrollable history timeline. All brief-related components built.

### Files to Create

```
src/dashboard/src/pages/DailyBrief.tsx
src/dashboard/src/pages/BriefHistory.tsx
src/dashboard/src/components/BriefCard.tsx
src/dashboard/src/components/FlagAlert.tsx
src/dashboard/src/components/CallStatusBadge.tsx
```

### Key Implementation Notes

**`DailyBrief.tsx`** (the home page at `/`):
- Load today's brief via `GET /api/briefs/:seniorId/today`
- If no call yet today: warm empty state with scheduled call time
- If call happened: show the brief card prominently
- Brief card anatomy:
  - Large mood emoji at top (😊 / 🙂 / 😐 / 😟 / ⚠️)
  - Headline sentence (`brief_text` first line)
  - Bullet points from the brief
  - `CallStatusBadge` (answered, skipped, no answer) + duration
  - Topics as soft pill/chip tags
  - If flags: `FlagAlert` component with amber/red background
  - Expandable "View what was said" section showing transcript
- If family has multiple seniors (edge case): show a selector

**`FlagAlert.tsx`:**
- Amber background for `low/medium` severity
- Red/urgent background for `high/urgent` severity
- Shows the flag text with `⚠️` prefix
- "Mark as seen" button which calls `PUT /api/flags/:id/acknowledge`

**`CallStatusBadge.tsx`:**
- Small pill badge: green for `answered`, grey for `skipped`, amber for `no_answer`, red for `failed`
- Shows duration in minutes if answered

**`BriefHistory.tsx`** (at `/history`):
- Load all briefs via `GET /api/briefs/:seniorId` (paginated, 20 per page)
- Scrollable vertical timeline
- Each entry is a `BriefCard` in compact mode (just date, mood emoji, first line, flag indicator)
- Click to expand full brief
- Filter bar: date range, mood filter (low mood only), flagged only
- Infinite scroll or "Load more" pagination

### What to Test

```bash
# Seed a few call_logs with brief_text using the seed.ts script
# Then view them in the dashboard:
open http://localhost:5173
# → Home shows today's brief (or warm empty state)
open http://localhost:5173/history
# → History shows past briefs in timeline
```

### Success Criteria

- [ ] Home shows today's brief with mood emoji prominently
- [ ] A brief with a flag shows `FlagAlert` with amber/red background
- [ ] `CallStatusBadge` shows correct color and duration
- [ ] Topics display as readable pill tags
- [ ] "View what was said" expander works
- [ ] History timeline shows briefs newest-first
- [ ] History filter for "flagged only" works
- [ ] All screens are mobile-responsive and use Dewcall colors
- [ ] Empty state is warm and helpful (not a generic "No data")

---

## Session 15 — Dashboard: Mood Trends, Parent Profile, Settings & Billing

**Goal:** The remaining dashboard pages. Mood chart, editable parent profile, settings, and billing management.

### Files to Create

```
src/dashboard/src/pages/MoodTrends.tsx
src/dashboard/src/pages/ParentProfile.tsx
src/dashboard/src/pages/Settings.tsx
src/dashboard/src/pages/Billing.tsx
src/dashboard/src/components/MoodChart.tsx
```

### Dependencies to Install

```
recharts
```

### Key Implementation Notes

**`MoodChart.tsx`:**
- `recharts` `LineChart` with `mood_score` (1–5) on Y axis, date on X axis
- Last 30 days of data from `GET /api/briefs/:seniorId/mood`
- Color line: blue for scores 3+, amber for 2, red for 1
- Plot `flag_events` as red dot markers on the timeline (overlay)
- "This week avg" vs "Last week avg" shown as two stat pills above the chart
- Y axis labels: 1=😟, 3=😐, 5=😊 (not numbers — too clinical)
- Copy: "How [Name] has been feeling" — never "Mood Analytics"

**`ParentProfile.tsx`:**
- Form to edit all senior fields: preferred name, hobbies, personality notes, health notes, cultural notes
- Call preferences section: call time, call frequency, companion name
- Memory flag selector (Normal / Caution) with a gentle tooltip explaining what Caution does: "Skips memory-based conversation topics on sensitive days"
- All saves via `PUT /api/seniors/:id`
- Custom call days picker (shown only when `call_frequency = 'custom'`)

**`Settings.tsx`:**
- Brief delivery channel (radio: SMS / WhatsApp / Email / All)
- Notification preferences (flags, no-answer notifications)
- Manage family access: list of linked family members with their relationship. "Add family member" button.
- Timezone setting
- Save via `PUT /api/settings`

**`Billing.tsx`:**
- Show plan status: "Free Trial" / "Active" / "Past Due" / "Cancelled"
- If trial: show days remaining, "Add payment method" button → `POST /api/billing/create-checkout`
- If active: "Manage subscription" → `POST /api/billing/portal` → redirect to Stripe portal
- If past due: warm (not alarming) notice: "There was an issue with your payment. Tap here to update."
- If cancelled: "Reactivate" button

**`NavBar.tsx`** — update (from Session 12) to include all 5 nav items:
- "Today" (home), "History", "Mood", "Profile", "Settings"
- Mobile: bottom tab bar. Desktop: left sidebar.
- Active state with Dewcall blue

### What to Test

```bash
open http://localhost:5173/mood
# → Mood chart renders (add seed data with varied mood_scores)
open http://localhost:5173/profile
# → Edit Maggie's hobbies, save, reload — should persist
open http://localhost:5173/settings
# → Change brief channel, save, verify in Supabase
open http://localhost:5173/billing
# → Shows trial status with days remaining
```

### Success Criteria

- [ ] Mood chart renders with 30-day data (test with seed data)
- [ ] Flag events appear as markers on the mood chart
- [ ] Y-axis shows emoji labels (not numbers)
- [ ] Editing and saving senior profile persists to Supabase
- [ ] Memory flag Caution/Normal selector works
- [ ] Settings save correctly and affect the senior's preferences
- [ ] Billing page shows correct status based on `subscription_status`
- [ ] "Manage subscription" redirects to Stripe customer portal
- [ ] All pages mobile-responsive

---

## Session 16 — Integration Testing & Launch Prep

**Goal:** Test all PRD §9.2 scenarios end-to-end, fix any integration gaps, configure deployment.

### Files to Create

```
railway.toml   (or render.yaml)
.env.production.example
```

### Test Scenarios to Execute (from PRD §9.2)

Run each of these manually and verify the full chain:

**1. Happy path:**
```
Trigger test-call.ts → Senior answers → 2-3 min conversation
→ Transcript saved → Brief generated → SMS/WhatsApp/Email delivered
→ Brief visible in dashboard → Memory entry saved
```
✓ Success: family receives brief within 5 minutes, brief is warm and specific.

**2. Skip path:**
```
Senior says "not now" early in the call
→ Call ends gracefully (Clara: "Of course! Have a wonderful morning")
→ Brief shows: "📞 0 min — skipped"
→ Family notified of the skip
```

**3. No-answer path:**
```
Call to a phone that won't answer
→ After 15 min, retry fires automatically (check cron logs)
→ Second no-answer → family receives: "[Name] didn't answer today..."
→ call_logs shows outcome: 'no_answer'
```

**4. Flag detection path:**
```
Use test-brief.ts with the sample transcript containing a fall mention
→ flag_events row created with category: 'physical', severity: 'high'
→ FlagAlert visible on dashboard home page
→ Separate urgent SMS sent to family member
```

**5. Memory continuity path:**
```
Run 3 calls (you can call test-brief.ts 3 times to generate 3 memory entries)
→ On the 3rd call, the system prompt contains memory from calls 1 and 2
→ Brief from call 3 references something specific from call 1
```

**6. Timezone path:**
```
Update the test senior's timezone to 'America/Los_Angeles' (PST, UTC-8)
Set call_time to 09:00
→ Scheduler should trigger at UTC 17:00, not UTC 09:00
```

**7. Multi-family path:**
```
Add a second family member link via POST /api/family/invite
→ After a call, both family members receive the brief
```

### Deployment Config

**`railway.toml`:**
```toml
[build]
builder = "NIXPACKS"
buildCommand = "npm run build"

[deploy]
startCommand = "npm start"
healthcheckPath = "/health"
restartPolicyType = "ON_FAILURE"
```

**Pre-deployment checklist:**
- [ ] All env vars set in Railway/Render dashboard
- [ ] `APP_URL` set to the real production URL (Twilio and Stripe need this for webhooks)
- [ ] Twilio webhook URLs updated to the production URL
- [ ] Stripe webhook endpoint updated to production URL
- [ ] Supabase project on free tier (or paid if needed for concurrent connections)
- [ ] Test the production health check: `curl https://dewcall.app/health`

### Update CLAUDE.md Commands Section

After this session, update `CLAUDE.md` with the real, working commands:
```markdown
## Commands
- `npm run dev` — start server (ts-node-dev with hot reload on port 3000)
- `cd src/dashboard && npm run dev` — start dashboard (Vite on port 5173)
- `npm run build` — compile server TypeScript to dist/
- `cd src/dashboard && npm run build` — build dashboard for production
- `npx ts-node scripts/test-call.ts <senior-id>` — trigger a live test call
- `npx ts-node scripts/test-brief.ts` — generate a brief from a sample transcript
- `npx ts-node src/server/db/seed.ts` — seed test family + senior data
```

### Final Success Criteria (PRD §11)

- [ ] A real call happens to a real phone — natural 2–3 min conversation, senior doesn't hang up annoyed
- [ ] Family member receives the brief via SMS within 5 minutes of call ending
- [ ] By call #3, the AI references something from call #1 naturally
- [ ] A flag is detected in a test scenario and the family is notified
- [ ] The dashboard is usable on mobile for a non-technical adult child
- [ ] Scheduler correctly handles PST/EST/UTC seniors without calling them at the wrong time
- [ ] Server has been running on Railway for 24 hours without crashing

---

## Appendix: Quick Reference

### External Service Accounts Needed Before Session 1
- Supabase project (free tier is fine for MVP)
- Anthropic API key (with billing enabled)
- Twilio account with a purchased phone number (voice + SMS enabled)
- ElevenLabs account (get a Voice ID for Clara)
- Deepgram account
- Resend account (verify a sending domain or use their sandbox)
- Stripe account in test mode

### Model Choices (from CLAUDE.md)
- **Live call conversation** (`call-agent.ts`): `claude-haiku-4-5-20251001` — latency over quality
- **Brief generation** (`brief-generator.ts`): `claude-sonnet-4-6` — quality over speed

### Critical Rules (Never Violate)
- Never use `supabaseAdmin` in user-facing API routes — it bypasses RLS
- Never store call audio — transcripts only
- All prompt changes are product changes — treat them as carefully as DB schema changes
- The emotional tone ("warm, never clinical") applies to code comments, error messages, and UI copy — not just the AI
- A missed scheduled call is a product failure — scheduler reliability takes precedence over code elegance
