export type WaveSamples = {
  sampleRate: number;
  samples: Float32Array;
};

export class WavFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WavFormatError";
  }
}

function readChunkName(view: DataView, offset: number) {
  return String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3),
  );
}

export function decodePcm16Wav(buffer: ArrayBuffer): WaveSamples {
  const view = new DataView(buffer);
  if (view.byteLength < 44 || readChunkName(view, 0) !== "RIFF" || readChunkName(view, 8) !== "WAVE") {
    throw new WavFormatError("Only RIFF/WAVE audio is supported.");
  }

  let channels = 0;
  let sampleRate = 0;
  let bitsPerSample = 0;
  let audioFormat = 0;
  let dataOffset = -1;
  let dataLength = 0;

  for (let offset = 12; offset + 8 <= view.byteLength; ) {
    const chunkName = readChunkName(view, offset);
    const chunkLength = view.getUint32(offset + 4, true);
    const chunkDataOffset = offset + 8;
    if (chunkDataOffset + chunkLength > view.byteLength) {
      throw new WavFormatError("WAV chunk length is invalid.");
    }

    if (chunkName === "fmt " && chunkLength >= 16) {
      audioFormat = view.getUint16(chunkDataOffset, true);
      channels = view.getUint16(chunkDataOffset + 2, true);
      sampleRate = view.getUint32(chunkDataOffset + 4, true);
      bitsPerSample = view.getUint16(chunkDataOffset + 14, true);
    } else if (chunkName === "data") {
      dataOffset = chunkDataOffset;
      dataLength = chunkLength;
    }

    offset = chunkDataOffset + chunkLength + (chunkLength % 2);
  }

  if (audioFormat !== 1 || bitsPerSample !== 16 || (channels !== 1 && channels !== 2) || dataOffset < 0) {
    throw new WavFormatError("Only mono or stereo 16-bit PCM WAV audio is supported.");
  }

  const frameCount = Math.floor(dataLength / (channels * 2));
  const samples = new Float32Array(frameCount);
  for (let frame = 0; frame < frameCount; frame += 1) {
    let sum = 0;
    for (let channel = 0; channel < channels; channel += 1) {
      const sampleOffset = dataOffset + (frame * channels + channel) * 2;
      sum += view.getInt16(sampleOffset, true) / 32768;
    }
    samples[frame] = sum / channels;
  }

  return { sampleRate, samples };
}
