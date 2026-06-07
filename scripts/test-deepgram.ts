import '../src/server/utils/config';
import { config } from '../src/server/utils/config';
import { DefaultDeepgramClient } from '@deepgram/sdk';

async function main() {
  console.log('Connecting to Deepgram live transcription (SDK v5)...');
  console.log('  model: nova-3 | encoding: mulaw | sample_rate: 8000');

  const client = new DefaultDeepgramClient({ apiKey: config.DEEPGRAM_API_KEY });

  const socket = await client.listen.v1.connect({
    model: 'nova-3',
    encoding: 'mulaw',
    sample_rate: 8000,
    smart_format: 'true',
    Authorization: `Token ${config.DEEPGRAM_API_KEY}`,
  });

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timed out after 10s')), 10000);

    socket.on('open', () => {
      clearTimeout(timeout);
      console.log('✅ Deepgram WebSocket OPEN — connection successful');
      console.log('   readyState:', socket.readyState);
      console.log('   Closing...');
      socket.close();
      resolve();
    });

    socket.on('error', (err: Error) => {
      clearTimeout(timeout);
      console.error('❌ Deepgram connection error:', err.message);
      reject(err);
    });

    socket.on('close', () => {
      console.log('   Connection closed cleanly.');
    });
  });
}

main().catch((e) => { console.error(e.message); process.exit(1); }).finally(() => process.exit(0));
