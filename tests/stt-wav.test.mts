import assert from "node:assert/strict";
import test from "node:test";

import { decodePcm16Wav, WavFormatError } from "../lib/speaking/stt/wav.ts";

function createMonoPcmWav(samples: number[], sampleRate = 16000) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeText = (offset: number, text: string) => {
    for (let index = 0; index < text.length; index += 1) {
      view.setUint8(offset + index, text.charCodeAt(index));
    }
  };
  writeText(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, samples.length * 2, true);
  samples.forEach((sample, index) => view.setInt16(44 + index * 2, sample, true));
  return buffer;
}

test("decodePcm16Wav exposes samples for SenseVoice input", () => {
  const decoded = decodePcm16Wav(createMonoPcmWav([0, 16384, -16384]));

  assert.equal(decoded.sampleRate, 16000);
  assert.equal(decoded.samples.length, 3);
  assert.equal(decoded.samples[0], 0);
  assert.equal(decoded.samples[1], 0.5);
  assert.equal(decoded.samples[2], -0.5);
});

test("decodePcm16Wav rejects unsupported audio bodies", () => {
  assert.throws(() => decodePcm16Wav(new TextEncoder().encode("not wav").buffer), WavFormatError);
});
