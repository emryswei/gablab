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
    const centerX = width / 2;
    const centerY = height / 2;
    const baseRadius = Math.min(width, height) * 0.27;
    const bars = 96;
    const freqData = new Uint8Array(2048);

    const render = () => {
      const analyser = analyserRef.current;
      const listening = isListeningRef.current;
      const assistantSpeaking = isAssistantSpeakingRef.current;
      const now = performance.now();

      if (analyser && listening) {
        analyser.getByteFrequencyData(freqData);
      } else {
        const elapsed = Math.max(0, now - aiSpeakingStartedAtRef.current);
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
      ctx.save();
      ctx.translate(centerX, centerY);

      let averageEnergy = 0;
      for (let i = 0; i < bars; i += 1) {
        const bin = Math.floor((i / bars) * Math.min(freqData.length, 768));
        averageEnergy += (freqData[bin] ?? 0) / 255;
      }
      averageEnergy /= bars;

      const active = listening || assistantSpeaking;
      const pulse = active ? Math.min(1, Math.pow(averageEnergy, 0.72) * 1.35) : 0.1 + 0.05 * Math.sin(now * 0.002);
      const rotation = now * (active ? 0.0007 : 0.00025);
      const outerRadius = baseRadius + pulse * 26;

      const halo = ctx.createRadialGradient(0, 0, baseRadius * 0.55, 0, 0, outerRadius + 74);
      halo.addColorStop(0, `rgba(45, 212, 191, ${0.18 + pulse * 0.14})`);
      halo.addColorStop(0.46, `rgba(96, 165, 250, ${0.1 + pulse * 0.1})`);
      halo.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(0, 0, outerRadius + 74, 0, Math.PI * 2);
      ctx.fill();

      for (let ring = 0; ring < 3; ring += 1) {
        const phase = now * 0.0022 + ring * 1.7;
        const radius = baseRadius + ring * 24 + pulse * (14 + ring * 4) + Math.sin(phase) * 4;
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.lineWidth = ring === 0 ? 3.5 : 1.5;
        ctx.strokeStyle =
          ring === 0
            ? `rgba(20, 184, 166, ${0.58 + pulse * 0.25})`
            : ring === 1
              ? `rgba(59, 130, 246, ${0.28 + pulse * 0.22})`
              : `rgba(251, 191, 36, ${0.22 + pulse * 0.16})`;
        ctx.stroke();
      }

      ctx.rotate(rotation);
      for (let i = 0; i < bars; i += 1) {
        const angle = (i / bars) * Math.PI * 2;
        const bin = Math.floor((i / bars) * Math.min(freqData.length, 768));
        const raw = (freqData[bin] ?? 0) / 255;
        const visualV = active ? Math.min(1, Math.pow(raw, 0.62) * 1.25) : 0.08 + 0.05 * Math.sin(now * 0.002 + i * 0.34);
        const lineLength = 8 + visualV * 42;
        const radius = outerRadius + 12 + Math.sin(now * 0.003 + i * 0.18) * 3;
        const innerX = Math.cos(angle) * radius;
        const innerY = Math.sin(angle) * radius;
        const outerX = Math.cos(angle) * (radius + lineLength);
        const outerY = Math.sin(angle) * (radius + lineLength);
        const hue = 176 + visualV * 34 + (i % 9) * 3;

        ctx.beginPath();
        ctx.moveTo(innerX, innerY);
        ctx.lineTo(outerX, outerY);
        ctx.lineWidth = 1.1 + visualV * 2.4;
        ctx.lineCap = "round";
        ctx.strokeStyle = `hsla(${hue}, 86%, ${54 + visualV * 18}%, ${0.34 + visualV * 0.56})`;
        ctx.stroke();
      }

      for (let i = 0; i < 5; i += 1) {
        const angle = rotation * (1.4 + i * 0.08) + i * ((Math.PI * 2) / 5);
        const radius = outerRadius + 30 + Math.sin(now * 0.002 + i) * 9;
        const dotSize = 2.6 + pulse * 3 + (i % 2) * 1.5;
        ctx.beginPath();
        ctx.arc(Math.cos(angle) * radius, Math.sin(angle) * radius, dotSize, 0, Math.PI * 2);
        ctx.fillStyle = i % 2 === 0 ? "rgba(45, 212, 191, 0.82)" : "rgba(251, 191, 36, 0.72)";
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(0, 0, baseRadius * 0.52 + pulse * 7, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(15, 23, 42, ${0.04 + pulse * 0.04})`;
      ctx.fill();
      ctx.restore();

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
