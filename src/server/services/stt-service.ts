import { DefaultDeepgramClient } from '@deepgram/sdk';
import type { V1Socket } from '@deepgram/sdk/dist/cjs/api/resources/listen/resources/v1/client/Socket';
import { config } from '../utils/config';
import { logger } from '../utils/logger';

type TranscriptCallback = (text: string, isFinal: boolean) => void;

/**
 * One DeepgramTranscriber per call.
 * Created by call-agent.ts at call start, torn down on call end.
 *
 * Audio flow: Twilio mulaw 8kHz → sendAudio() → Deepgram → onTranscript callback
 */
export class DeepgramTranscriber {
  private socket: V1Socket | null = null;
  private transcriptCallback: TranscriptCallback | null = null;
  private readonly callSid: string;
  private _onError?: (err: Error) => void;

  constructor(callSid: string) {
    this.callSid = callSid;
  }

  /** Open a live transcription session. Must be called before sendAudio(). */
  async start(): Promise<void> {
    const deepgram = new DefaultDeepgramClient({ apiKey: config.DEEPGRAM_API_KEY });

    this.socket = await deepgram.listen.v1.connect({
      model: 'nova-3',
      encoding: 'mulaw',
      sample_rate: 8000,
      smart_format: 'true',
      interim_results: 'true',
      Authorization: `Token ${config.DEEPGRAM_API_KEY}`,
    });

    this.socket.on('open', () => {
      logger.info('Deepgram session open', { callSid: this.callSid });
    });

    this.socket.on('message', (msg) => {
      // Only forward final transcripts — interim results increase noise without value
      // for the call agent's turn-based conversation model
      if (!('channel' in msg)) return;
      const result = msg as { channel: { alternatives: { transcript: string }[] }; is_final: boolean };
      const transcript = result.channel?.alternatives?.[0]?.transcript ?? '';
      if (!transcript) return;

      const isFinal = result.is_final ?? false;
      this.transcriptCallback?.(transcript, isFinal);
    });

    this.socket.on('error', (err: Error) => {
      logger.error('Deepgram error', { callSid: this.callSid, error: err.message });
      this._onError?.(err);
    });

    this.socket.on('close', () => {
      logger.info('Deepgram session closed', { callSid: this.callSid });
    });

    await this.socket.waitForOpen();
  }

  /** Register the callback that receives transcribed text. */
  onTranscript(callback: TranscriptCallback): void {
    this.transcriptCallback = callback;
  }

  /** Register an error handler (used by call-agent for reconnect logic). */
  onError(handler: (err: Error) => void): void {
    this._onError = handler;
  }

  /** Send a raw mu-law 8kHz audio chunk to Deepgram. */
  sendAudio(chunk: Buffer): void {
    if (!this.socket) return;
    this.socket.sendMedia(chunk);
  }

  /** Reconnect after a transient Deepgram failure. Replaces the socket in-place. */
  async restart(): Promise<void> {
    this.stop();
    await this.start();
  }

  /** Close the Deepgram session. Safe to call multiple times. */
  stop(): void {
    if (!this.socket) return;
    try {
      this.socket.close();
    } catch {
      // already closed — ignore
    }
    this.socket = null;
  }
}
