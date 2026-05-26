import { existsSync } from "node:fs";
import path from "node:path";

import type { WaveSamples } from "./wav";

const MODEL_DIRECTORY = "sherpa-onnx-sense-voice-zh-en-ja-ko-yue-int8-2024-07-17";
const DEFAULT_MODEL_ROOT = path.join(process.cwd(), "models", "sensevoice", MODEL_DIRECTORY);

type OfflineRecognizer = import("sherpa-onnx-node").OfflineRecognizer;

let recognizerPromise: Promise<OfflineRecognizer> | null = null;

export class SenseVoiceConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SenseVoiceConfigurationError";
  }
}

function getModelPaths() {
  const root = process.env.SENSEVOICE_MODEL_DIR || DEFAULT_MODEL_ROOT;
  return {
    model: path.join(root, "model.int8.onnx"),
    tokens: path.join(root, "tokens.txt"),
  };
}

async function createRecognizer() {
  const modelPaths = getModelPaths();
  if (!existsSync(modelPaths.model) || !existsSync(modelPaths.tokens)) {
    throw new SenseVoiceConfigurationError(
      "SenseVoice model files are missing. Run `npm run setup:sensevoice` or set SENSEVOICE_MODEL_DIR.",
    );
  }

  const sherpa = await import("sherpa-onnx-node");
  return sherpa.OfflineRecognizer.createAsync({
    featConfig: {
      sampleRate: 16000,
      featureDim: 80,
    },
    modelConfig: {
      senseVoice: {
        model: modelPaths.model,
        language: "yue",
        useInverseTextNormalization: 1,
      },
      tokens: modelPaths.tokens,
      numThreads: 2,
      provider: "cpu",
      debug: 0,
    },
  });
}

async function getRecognizer() {
  if (!recognizerPromise) {
    recognizerPromise = createRecognizer().catch((error: unknown) => {
      recognizerPromise = null;
      throw error;
    });
  }
  return recognizerPromise;
}

export async function transcribeCantonese(samples: WaveSamples) {
  const recognizer = await getRecognizer();
  const stream = recognizer.createStream();
  stream.acceptWaveform(samples);
  const result = await recognizer.decodeAsync(stream);
  return result.text?.trim() ?? "";
}
