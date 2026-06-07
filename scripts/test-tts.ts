import '../src/server/utils/config';
import { textToSpeech, textToSpeechStream } from '../src/server/services/tts-service';
import * as fs from 'fs';

async function main() {
  // Test 1: full buffer
  console.log('Test 1: textToSpeech() — full buffer...');
  const buf = await textToSpeech('Good morning Maggie! This is Clara. How are you today?');
  const outPath = '/tmp/dewcall-clara.ulaw';
  fs.writeFileSync(outPath, buf);
  console.log(`✅ ${buf.length} bytes → ${outPath}`);
  console.log(`   Format: ulaw_8000 (mu-law, 8kHz, mono)`);

  // Test 2: streaming — count chunks and total bytes
  console.log('\nTest 2: textToSpeechStream() — streaming...');
  const stream = await textToSpeechStream("It's been such a lovely chat! I'll talk to you again soon.");
  let chunkCount = 0;
  let totalBytes = 0;
  for await (const chunk of stream) {
    chunkCount++;
    totalBytes += chunk.length;
  }
  console.log(`✅ Stream: ${chunkCount} chunks, ${totalBytes} bytes total`);

  // Test 3: error path — wrong voice ID
  console.log('\nTest 3: error path — bad voice ID should throw...');
  try {
    const { ElevenLabsClient } = await import('elevenlabs');
    const badClient = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY });
    const r = await badClient.textToSpeech.convert('INVALID_VOICE_ID', {
      text: 'test',
      model_id: 'eleven_turbo_v2_5',
      output_format: 'ulaw_8000',
    });
    for await (const _ of r) {} // consume stream
    console.log('❌ Expected an error but got none');
  } catch (err: any) {
    console.log(`✅ Error thrown as expected: ${err.statusCode ?? err.message}`);
  }
}

main().catch((e) => { console.error('❌', e.message); process.exit(1); }).finally(() => process.exit(0));
