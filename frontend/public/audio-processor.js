/**
 * AudioWorklet processor for capturing PCM16 audio at 24kHz.
 * Converts Float32 samples to Int16, computes RMS amplitude, and posts both to the main thread.
 */
class AudioCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffer = new Float32Array(0);
    this._chunkSize = 2400; // 100ms at 24kHz
  }

  process(inputs, _outputs, _parameters) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const channelData = input[0];

    const newBuffer = new Float32Array(this._buffer.length + channelData.length);
    newBuffer.set(this._buffer);
    newBuffer.set(channelData, this._buffer.length);
    this._buffer = newBuffer;

    while (this._buffer.length >= this._chunkSize) {
      const chunk = this._buffer.slice(0, this._chunkSize);
      this._buffer = this._buffer.slice(this._chunkSize);

      // Compute RMS amplitude (0.0 to 1.0)
      let sum = 0;
      for (let i = 0; i < chunk.length; i++) {
        sum += chunk[i] * chunk[i];
      }
      const rms = Math.sqrt(sum / chunk.length);

      // Convert Float32 to Int16
      const int16 = new Int16Array(chunk.length);
      for (let i = 0; i < chunk.length; i++) {
        const s = Math.max(-1, Math.min(1, chunk[i]));
        int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }

      this.port.postMessage(
        { type: "audio", data: int16.buffer, amplitude: rms },
        [int16.buffer]
      );
    }

    return true;
  }
}

registerProcessor("audio-capture-processor", AudioCaptureProcessor);
