import '../src/server/utils/config';
import { DeepgramTranscriber } from '../src/server/services/stt-service';

async function main() {
  console.log('Test 1: DeepgramTranscriber — connect and close...');
  const transcriber = new DeepgramTranscriber('test-call-sid');

  transcriber.onTranscript((text, isFinal) => {
    console.log(`  Transcript [isFinal=${isFinal}]: "${text}"`);
  });

  transcriber.onError((err) => {
    console.error('  Deepgram error:', err.message);
  });

  await transcriber.start();
  console.log('✅ Deepgram session started');

  // Send a small silent mulaw payload to confirm sendAudio() doesn't throw
  const silentMulaw = Buffer.alloc(160, 0xFF); // 20ms of silence at 8kHz mulaw
  transcriber.sendAudio(silentMulaw);
  console.log('✅ sendAudio() accepted 160-byte silent chunk');

  // Brief wait to let any response arrive
  await new Promise(r => setTimeout(r, 1500));

  transcriber.stop();
  console.log('✅ stop() called cleanly');

  // Test 2: double stop is safe
  transcriber.stop();
  console.log('✅ double stop() — no error');
}

main().catch((e) => { console.error('❌', e.message); process.exit(1); }).finally(() => process.exit(0));
