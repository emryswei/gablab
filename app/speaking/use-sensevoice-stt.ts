"use client";

import { useCallback, useEffect, useRef } from "react";

const TARGET_SAMPLE_RATE = 16000;
const SPEECH_THRESHOLD = 0.014;
const SPEECH_END_SILENCE_MS = 1100;

type TurnCallbacks = {
  onSpeechStart: () => void;
  onCaptureEnd: () => void;
};

type ActiveCapture = {
  cancel: () => void;
};

type SttResponse = {
  text?: string;
  error?: string;
};

function mergeChunks(chunks: Float32Array[]) {
  const length = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const merged = new Float32Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged;
}

function resample(samples: Float32Array, sourceSampleRate: number) {
  if (sourceSampleRate === TARGET_SAMPLE_RATE) return samples;
  const outputLength = Math.round((samples.length * TARGET_SAMPLE_RATE) / sourceSampleRate);
  const output = new Float32Array(outputLength);
  const ratio = sourceSampleRate / TARGET_SAMPLE_RATE;
  for (let index = 0; index < outputLength; index += 1) {
    const sourcePosition = index * ratio;
    const before = Math.floor(sourcePosition);
    const after = Math.min(before + 1, samples.length - 1);
    const fraction = sourcePosition - before;
    output[index] = samples[before] + (samples[after] - samples[before]) * fraction;
  }
  return output;
}

function encodePcm16Wav(samples: Float32Array) {
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
  view.setUint32(24, TARGET_SAMPLE_RATE, true);
  view.setUint32(28, TARGET_SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, samples.length * 2, true);

  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index]));
    view.setInt16(44 + index * 2, sample < 0 ? sample * 32768 : sample * 32767, true);
  }
  return buffer;
}

export function useSenseVoiceStt() {
  const activeCaptureRef = useRef<ActiveCapture | null>(null);

  const stopCapture = useCallback(() => {
    activeCaptureRef.current?.cancel();
    activeCaptureRef.current = null;
  }, []);

  const captureAndTranscribe = useCallback(
    async (stream: MediaStream, callbacks: TurnCallbacks) => {
      stopCapture();
      const audioContext = new window.AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      const mutedOutput = audioContext.createGain();
      const sourceSampleRate = audioContext.sampleRate;
      mutedOutput.gain.value = 0;

      const chunks: Float32Array[] = [];
      let speechStarted = false;
      let silenceStartedAt = 0;
      let settled = false;

      await audioContext.resume();

      return new Promise<string | null>((resolve, reject) => {
        const settle = async (shouldTranscribe: boolean) => {
          if (settled) return;
          settled = true;
          processor.disconnect();
          source.disconnect();
          mutedOutput.disconnect();
          await audioContext.close();
          activeCaptureRef.current = null;
          callbacks.onCaptureEnd();

          if (!shouldTranscribe) {
            resolve(null);
            return;
          }

          try {
            const samples = resample(mergeChunks(chunks), sourceSampleRate);
            const response = await fetch("/api/speaking/stt", {
              method: "POST",
              headers: { "Content-Type": "audio/wav" },
              body: encodePcm16Wav(samples),
            });
            const payload = (await response.json()) as SttResponse;
            if (!response.ok) {
              throw new Error(payload.error ?? "Cantonese transcription failed.");
            }
            resolve(payload.text?.trim() || "");
          } catch (error) {
            reject(error);
          }
        };

        activeCaptureRef.current = {
          cancel: () => {
            void settle(false);
          },
        };

        processor.onaudioprocess = (event) => {
          const input = event.inputBuffer.getChannelData(0);
          const chunk = new Float32Array(input);
          chunks.push(chunk);

          let squareSum = 0;
          for (const sample of chunk) {
            squareSum += sample * sample;
          }
          const rms = Math.sqrt(squareSum / chunk.length);
          const now = performance.now();
          if (rms >= SPEECH_THRESHOLD) {
            if (!speechStarted) {
              speechStarted = true;
              callbacks.onSpeechStart();
            }
            silenceStartedAt = 0;
            return;
          }

          if (speechStarted) {
            silenceStartedAt ||= now;
            if (now - silenceStartedAt >= SPEECH_END_SILENCE_MS) {
              void settle(true);
            }
          }
        };

        source.connect(processor);
        processor.connect(mutedOutput);
        mutedOutput.connect(audioContext.destination);
      });
    },
    [stopCapture],
  );

  useEffect(() => stopCapture, [stopCapture]);

  return { captureAndTranscribe, stopCapture };
}
