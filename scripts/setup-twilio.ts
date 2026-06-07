/**
 * scripts/setup-twilio.ts
 * Verify Twilio account, list phone numbers, and confirm the configured
 * number is active and voice-capable.
 *
 * Run once before Session 6 live testing:
 *   npx ts-node scripts/setup-twilio.ts
 */
import '../src/server/utils/config';
import { config } from '../src/server/utils/config';
import twilio from 'twilio';

async function main() {
  const client = twilio(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN);

  // ── Account status ─────────────────────────────────────────────────────────
  console.log('\n🔍 Checking Twilio account...');
  const account = await client.api.v2010.accounts(config.TWILIO_ACCOUNT_SID).fetch();
  const statusIcon = account.status === 'active' ? '✅' : '⚠️';
  console.log(`${statusIcon} Account: ${account.friendlyName}`);
  console.log(`   Status: ${account.status}`);
  console.log(`   Type:   ${account.type}`);

  if (account.status !== 'active') {
    console.error('\n❌ Account is not active — calls will not work.');
    process.exit(1);
  }

  // ── Phone numbers ──────────────────────────────────────────────────────────
  console.log('\n📋 Incoming phone numbers on this account:');
  const numbers = await client.incomingPhoneNumbers.list({ limit: 20 });

  if (numbers.length === 0) {
    console.error('❌ No phone numbers found — purchase one in the Twilio console.');
    process.exit(1);
  }

  let configuredNumberFound = false;
  for (const num of numbers) {
    const cap = num.capabilities as { voice?: boolean; sms?: boolean };
    const voice = cap.voice ? '✅ voice' : '❌ no voice';
    const sms   = cap.sms   ? '✅ SMS'   : '❌ no SMS';
    const match = num.phoneNumber === config.TWILIO_PHONE_NUMBER ? ' ← TWILIO_PHONE_NUMBER' : '';
    console.log(`   ${num.phoneNumber}  [${voice}, ${sms}]${match}`);

    if (num.phoneNumber === config.TWILIO_PHONE_NUMBER) {
      configuredNumberFound = true;
      if (!cap.voice) {
        console.error(`\n❌ TWILIO_PHONE_NUMBER ${num.phoneNumber} is NOT voice-capable.`);
        process.exit(1);
      }
    }
  }

  if (!configuredNumberFound) {
    console.error(`\n❌ TWILIO_PHONE_NUMBER (${config.TWILIO_PHONE_NUMBER}) not found on this account.`);
    process.exit(1);
  }

  // ── Webhook readiness ──────────────────────────────────────────────────────
  console.log('\n🌐 Webhook URLs that Twilio will call:');
  console.log(`   Voice:  ${config.APP_URL}/webhooks/twilio/voice`);
  console.log(`   Status: ${config.APP_URL}/webhooks/twilio/status`);
  console.log(`   WS:     wss://${new URL(config.APP_URL).host}/ws/call/<callSid>`);

  const isNgrok = config.APP_URL.includes('ngrok');
  const isLocalhost = config.APP_URL.includes('localhost');
  if (isLocalhost) {
    console.log('\n⚠️  APP_URL is localhost — Twilio cannot reach it. Run ngrok and update APP_URL.');
  } else if (isNgrok) {
    console.log('\n✅ APP_URL looks like a public ngrok URL — Twilio should be able to reach it.');
  } else {
    console.log('\n✅ APP_URL is a public URL — ready for production.');
  }

  console.log('\n✅ Twilio setup check complete.\n');
}

main().catch((err: Error) => {
  console.error('❌ Setup check failed:', err.message);
  process.exit(1);
});
