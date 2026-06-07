import { ElevenLabsClient } from 'elevenlabs';
import { config } from '../utils/config';
import { logger } from '../utils/logger';

const client = new ElevenLabsClient({ apiKey: config.ELEVENLABS_API_KEY });

// Use turbo model for low latency in the live call loop (<1.5s budget per §8.1)
const MODEL_ID = 'eleven_turbo_v2_5';
// ulaw_8000 = mu-law 8kHz — Twilio's native format, no resampling needed
const OUTPUT_FORMAT = 'ulaw_8000' as const;

/**
 * Convert text to a complete audio buffer (mu-law 8kHz).
 * Use for pre-generated fillers or non-latency-critical audio.
 */
export async function textToSpeech(text: string): Promise<Buffer> {
  try {
    const readable = await client.textToSpeech.convert(config.ELEVENLABS_VOICE_ID, {
      text,
      model_id: MODEL_ID,
      output_format: OUTPUT_FORMAT,
    });

    const chunks: Buffer[] = [];
    for await (const chunk of readable) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array));
    }

    const audio = Buffer.concat(chunks);
    logger.debug(`TTS complete: ${text.slice(0, 40)}… → ${audio.length} bytes`);
    return audio;
  } catch (err) {
    logger.error('ElevenLabs TTS failed', { error: err });
    throw err;
  }
}

/**
 * Stream text to speech as an AsyncIterable of mu-law 8kHz chunks.
 * Use in the live call loop — first chunk arrives in ~400ms, enabling
 * sub-1.5s STT→Claude→TTS latency target.
 */
export async function textToSpeechStream(text: string): Promise<AsyncIterable<Buffer>> {
  try {
    const readable = await client.textToSpeech.convertAsStream(config.ELEVENLABS_VOICE_ID, {
      text,
      model_id: MODEL_ID,
      output_format: OUTPUT_FORMAT,
      optimize_streaming_latency: 3,
    });

    // Wrap Node Readable in an AsyncIterable that yields Buffers
    return (async function* () {
      for await (const chunk of readable) {
        yield Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
      }
    })();
  } catch (err) {
    logger.error('ElevenLabs TTS stream failed', { error: err });
    throw err;
  }
}
