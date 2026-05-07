"use client";

import { useEffect, useRef } from "react";

type UseMicVisualizerOptions = {
  aiSpeakingSeedRef: React.RefObject<number>;
  aiSpeakingStartedAtRef: React.RefObject<number>;
  isAssistantSpeakingRef: React.RefObject<boolean>;
  isListeningRef: React.RefObject<boolean>;
  setError: (message: string | null) => void;
};

export function useMicVisualizer({
  aiSpeakingSeedRef,
  aiSpeakingStartedAtRef,
  isAssistantSpeakingRef,
  isListeningRef,
  setError,
}: UseMicVisualizerOptions) {
  const visualizerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const visualizerRafRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);

  const ensureMicVisualizer = async () => {
    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      return;
    }

    if (analyserRef.current && audioContextRef.current) {
      if (audioContextRef.current.state === "suspended") {
        await audioContextRef.current.resume();
      }
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const audioContext = new window.AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.82;
      source.connect(analyser);

      micStreamRef.current = stream;
      audioContextRef.current = audioContext;
      micSourceRef.current = source;
      analyserRef.current = analyser;
    } catch {
      setError("Microphone access is required for real-time wave visualization.");
    }
  };

  useEffect(() => {
    const canvas = visualizerCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const bars = 78;
    const barGap = 3;
    const barWidth = Math.max(1, (width - (bars - 1) * barGap) / bars);
    const freqData = new Uint8Array(2048);

    const render = () => {
      const analyser = analyserRef.current;
      const listening = isListeningRef.current;
      const assistantSpeaking = isAssistantSpeakingRef.current;

      if (analyser && listening) {
        analyser.getByteFrequencyData(freqData);
      } else {
        const elapsed = Math.max(0, performance.now() - aiSpeakingStartedAtRef.current);
        const seed = aiSpeakingSeedRef.current;
        const sampleRate = audioContextRef.current?.sampleRate ?? 48000;
        const nyquist = sampleRate / 2;

        const phraseEnvelope = 0.45 + 0.55 * Math.max(0, Math.sin(elapsed * 0.004 + seed * 0.001));
        const syllableEnvelope = 0.35 + 0.65 * Math.max(0, Math.sin(elapsed * 0.013 + seed * 0.017));
        const baseF0 =
          120 +
          35 * Math.sin(elapsed * 0.0026 + seed * 0.003) +
          18 * Math.sin(elapsed * 0.0051 + seed * 0.009);

        const formant1 = 420 + 140 * Math.sin(elapsed * 0.0019 + seed * 0.004);
        const formant2 = 1500 + 320 * Math.sin(elapsed * 0.0013 + seed * 0.007);
        const formant3 = 2550 + 260 * Math.sin(elapsed * 0.001 + seed * 0.011);

        for (let i = 0; i < freqData.length; i += 1) {
          const freqHz = (i / (freqData.length - 1)) * nyquist;
          if (assistantSpeaking) {
            let harmonicEnergy = 0;
            for (let h = 1; h <= 7; h += 1) {
              const harmonicFreq = baseF0 * h;
              if (harmonicFreq > nyquist) break;
              const spread = 20 + h * 8;
              const distance = Math.abs(freqHz - harmonicFreq);
              harmonicEnergy += Math.exp(-Math.pow(distance / spread, 2)) * (1 / h);
            }

            const vowelShape =
              0.9 * Math.exp(-Math.pow((freqHz - formant1) / 170, 2)) +
              0.75 * Math.exp(-Math.pow((freqHz - formant2) / 230, 2)) +
              0.55 * Math.exp(-Math.pow((freqHz - formant3) / 320, 2));

            const fricativeNoise = 0.06 * Math.exp(-Math.pow((freqHz - 4200) / 1300, 2));
            const energy = Math.min(
              1,
              (harmonicEnergy * (0.72 + vowelShape) + fricativeNoise) * phraseEnvelope * syllableEnvelope,
            );
            const emphasized = Math.min(1, Math.pow(energy, 0.66) * 1.32);
            freqData[i] = Math.floor(emphasized * 255);
          } else {
            freqData[i] = 0;
          }
        }
      }

      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < bars; i += 1) {
        const bin = Math.floor((i / bars) * Math.min(freqData.length, 1024));
        const v = (freqData[bin] ?? 0) / 255;
        const visualV = assistantSpeaking ? Math.min(1, Math.pow(v, 0.72) * 1.2) : v;
        const h = Math.max(assistantSpeaking ? 8 : 2, visualV * (height - 10));
        const x = i * (barWidth + barGap);
        const y = height - h - 2;
        const hue = 210 - visualV * 75;
        const light = 35 + visualV * 44;
        ctx.fillStyle = `hsl(${hue}, 95%, ${light}%)`;
        ctx.fillRect(x, y, barWidth, h);

        if (assistantSpeaking) {
          ctx.fillStyle = `hsla(${hue - 8}, 98%, 86%, 0.42)`;
          ctx.fillRect(x, y, barWidth, 2);
        }
      }

      visualizerRafRef.current = window.requestAnimationFrame(render);
    };

    visualizerRafRef.current = window.requestAnimationFrame(render);
    return () => {
      if (visualizerRafRef.current !== null) {
        window.cancelAnimationFrame(visualizerRafRef.current);
      }
    };
  }, [aiSpeakingSeedRef, aiSpeakingStartedAtRef, isAssistantSpeakingRef, isListeningRef]);

  useEffect(() => {
    return () => {
      if (visualizerRafRef.current !== null) {
        window.cancelAnimationFrame(visualizerRafRef.current);
      }
      micSourceRef.current?.disconnect();
      if (audioContextRef.current) {
        void audioContextRef.current.close();
      }
      micStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return {
    ensureMicVisualizer,
    visualizerCanvasRef,
  };
}

