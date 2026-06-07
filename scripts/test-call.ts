/**
 * scripts/test-call.ts
 * Trigger a live test call to a senior's phone.
 *
 * Usage:
 *   npx ts-node scripts/test-call.ts <senior-id>
 *
 * Requirements:
 *   - Server must be running:   npm run dev
 *   - ngrok must be tunnelling: ngrok http 3000
 *   - APP_URL in .env must match the ngrok URL
 *   - ADMIN_SECRET must be set in .env
 */
import '../src/server/utils/config';
import { config } from '../src/server/utils/config';

const seniorId = process.argv[2];
if (!seniorId) {
  console.error('Usage: npx ts-node scripts/test-call.ts <senior-id>');
  process.exit(1);
}

if (!config.ADMIN_SECRET) {
  console.error('❌ ADMIN_SECRET is not set in .env');
  process.exit(1);
}

async function main() {
  const serverUrl = process.env.SERVER_URL ?? 'http://localhost:3000';
  const url = `${serverUrl}/api/admin/test-call/${seniorId}`;

  console.log(`\n📞 Triggering test call for senior: ${seniorId}`);
  console.log(`   → POST ${url}\n`);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Secret': config.ADMIN_SECRET!,
    },
  });

  const body = await res.json() as { ok?: boolean; callSid?: string; error?: string };

  if (!res.ok || !body.ok) {
    console.error(`❌ Failed (HTTP ${res.status}): ${body.error ?? 'Unknown error'}`);
    process.exit(1);
  }

  console.log(`✅ Call placed!`);
  console.log(`   Twilio Call SID: ${body.callSid}`);
  console.log(`\n   Watch the server logs for the conversation flow.`);
  console.log(`   Check Supabase call_logs for the transcript after the call ends.\n`);
  console.log(`   Expected log sequence:`);
  console.log(`     1. POST /webhooks/twilio/voice 200    ← Twilio hit the webhook`);
  console.log(`     2. WS upgrade: /ws/call/CA...         ← WebSocket connected`);
  console.log(`     3. Media stream started, streamSid:   ← start event received`);
  console.log(`     4. Greeting sent                      ← opening TTS played`);
  console.log(`     5. Transcript [final]: <text>         ← Deepgram transcribing`);
  console.log(`     6. Claude response: <text>            ← AI turn working`);
  console.log(`     7. TTS audio sent: <N> bytes          ← ElevenLabs audio back`);
  console.log(`     8. Call ended, transcript saved       ← on hangup\n`);
}

main().catch((err) => {
  console.error('❌', (err as Error).message);
  process.exit(1);
});
