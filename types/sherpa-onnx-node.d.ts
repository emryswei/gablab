declare module "sherpa-onnx-node" {
  type Waveform = {
    sampleRate: number;
    samples: Float32Array;
  };

  type SenseVoiceConfig = {
    model: string;
    language?: string;
    useInverseTextNormalization?: number;
  };

  type OfflineRecognizerConfig = {
    featConfig: {
      sampleRate: number;
      featureDim: number;
    };
    modelConfig: {
      senseVoice: SenseVoiceConfig;
      tokens: string;
      numThreads?: number;
      provider?: string;
      debug?: number;
    };
  };

  type OfflineRecognizerResult = {
    text?: string;
  };

  class OfflineStream {
    acceptWaveform(waveform: Waveform): void;
  }

  export class OfflineRecognizer {
    constructor(config: OfflineRecognizerConfig);
    static createAsync(config: OfflineRecognizerConfig): Promise<OfflineRecognizer>;
    createStream(): OfflineStream;
    decodeAsync(stream: OfflineStream): Promise<OfflineRecognizerResult>;
  }
}
