// Audio format bridge between Twilio, Deepgram, and ElevenLabs.
//
// Pipeline summary (no PCM conversion needed):
//   Twilio inbound  → base64-encoded mulaw 8kHz  → decode to Buffer → Deepgram
//   ElevenLabs out  → mulaw 8kHz Buffer           → encode to base64 → Twilio
//
// All mu-law encode/decode happens inside Deepgram and ElevenLabs —
// this file only handles base64 bridging and Twilio WS message construction.

/** Decode Twilio's base64 mulaw payload into raw bytes for Deepgram. */
export function twilioPayloadToBuffer(base64Payload: string): Buffer {
  return Buffer.from(base64Payload, 'base64');
}

/** Encode an ElevenLabs mulaw buffer into base64 for Twilio. */
export function bufferToTwilioPayload(buffer: Buffer): string {
  return buffer.toString('base64');
}

/** JSON media message to stream audio back to the senior through Twilio. */
export function buildTwilioMediaMessage(streamSid: string, base64Payload: string): string {
  return JSON.stringify({
    event: 'media',
    streamSid,
    media: { payload: base64Payload },
  });
}

/** JSON mark message — Twilio fires back when it reaches this point in the audio queue. */
export function buildTwilioMarkMessage(streamSid: string, label: string): string {
  return JSON.stringify({
    event: 'mark',
    streamSid,
    mark: { name: label },
  });
}

/** JSON clear message — stops currently playing audio (barge-in). */
export function buildTwilioClearMessage(streamSid: string): string {
  return JSON.stringify({
    event: 'clear',
    streamSid,
  });
}

/**
 * Split a large audio buffer into chunks.
 * Twilio recommends chunked payloads for smooth playback;
 * 8 kB ≈ 1 second of mulaw 8kHz audio.
 */
export function chunkBuffer(buffer: Buffer, chunkSize = 8192): Buffer[] {
  const chunks: Buffer[] = [];
  for (let offset = 0; offset < buffer.length; offset += chunkSize) {
    chunks.push(buffer.subarray(offset, offset + chunkSize));
  }
  return chunks;
}
