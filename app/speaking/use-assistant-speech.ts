"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { selectBrowserVoice, type EnglishAccent } from "@/lib/speaking/browser-voices";

type TtsFallbackResponse = {
  fallback?: boolean;
  reason?: string;
};

type UseAssistantSpeechOptions = {
  browserVoicesRef: React.RefObject<SpeechSynthesisVoice[]>;
  selectedAccentRef: React.RefObject<EnglishAccent>;
  setError: (message: string | null) => void;
};

const browserOnlyTts = process.env.NEXT_PUBLIC_TTS_PROVIDER?.toLowerCase() === "browser";

function hashText(text: string) {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return (hash % 997) + 1;
}

export function useAssistantSpeech({ browserVoicesRef, selectedAccentRef, setError }: UseAssistantSpeechOptions) {
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);
  const ttsObjectUrlRef = useRef<string | null>(null);
  const aiSpeakingStartedAtRef = useRef(0);
  const aiSpeakingSeedRef = useRef(1);
  const isAssistantSpeakingRef = useRef(false);
  const [isAssistantSpeaking, setIsAssistantSpeaking] = useState(false);

  useEffect(() => {
    isAssistantSpeakingRef.current = isAssistantSpeaking;
  }, [isAssistantSpeaking]);

  const setAssistantSpeaking = useCallback((speaking: boolean) => {
    isAssistantSpeakingRef.current = speaking;
    setIsAssistantSpeaking(speaking);
  }, []);

  const stopAssistantSpeech = useCallback(() => {
    if (ttsAudioRef.current) {
      ttsAudioRef.current.pause();
      ttsAudioRef.current.src = "";
    }
    if (ttsObjectUrlRef.current) {
      URL.revokeObjectURL(ttsObjectUrlRef.current);
      ttsObjectUrlRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setAssistantSpeaking(false);
  }, [setAssistantSpeaking]);

  const speakWithBrowserVoice = (text: string, onDone?: () => void) => {
    setError(null);

    if (!("speechSynthesis" in window)) {
      setAssistantSpeaking(false);
      onDone?.();
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const accent = selectedAccentRef.current;
    const voice = selectBrowserVoice(browserVoicesRef.current, accent);
    utterance.lang = voice?.lang ?? accent;
    utterance.voice = voice;
    utterance.rate = 0.96;
    utterance.pitch = 1;
    utterance.onend = () => {
      setAssistantSpeaking(false);
      onDone?.();
    };
    utterance.onerror = () => {
      setAssistantSpeaking(false);
    };
    window.speechSynthesis.speak(utterance);
  };

  const speakOutLoud = async (text: string, onDone?: () => void) => {
    if (typeof window === "undefined") {
      onDone?.();
      return;
    }

    setAssistantSpeaking(true);
    aiSpeakingStartedAtRef.current = performance.now();
    aiSpeakingSeedRef.current = hashText(text);
    setError(null);

    if (browserOnlyTts) {
      speakWithBrowserVoice(text, onDone);
      return;
    }

    try {
      const response = await fetch("/api/speaking/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      const contentType = response.headers.get("content-type") ?? "";
      const shouldUseBrowserFallback = response.headers.get("x-tts-fallback") === "1";
      if (shouldUseBrowserFallback) {
        const payload = (await response.json().catch(() => ({}))) as TtsFallbackResponse;
        if (payload.fallback) {
          speakWithBrowserVoice(text, onDone);
          return;
        }
      }

      if (!response.ok || !contentType.startsWith("audio/")) {
        const payload = (await response.json().catch(() => ({}))) as TtsFallbackResponse;
        throw new Error(payload.reason ?? "API TTS unavailable");
      }

      const audioBlob = await response.blob();
      if (ttsAudioRef.current) {
        ttsAudioRef.current.pause();
        ttsAudioRef.current.src = "";
      }
      if (ttsObjectUrlRef.current) {
        URL.revokeObjectURL(ttsObjectUrlRef.current);
      }

      const objectUrl = URL.createObjectURL(audioBlob);
      ttsObjectUrlRef.current = objectUrl;

      const audio = new Audio(objectUrl);
      ttsAudioRef.current = audio;
      audio.onended = () => {
        setAssistantSpeaking(false);
        onDone?.();
      };
      audio.onerror = () => {
        setAssistantSpeaking(false);
      };
      await audio.play();
    } catch (err) {
      console.warn("API TTS unavailable. Using browser voice fallback.", err);
      speakWithBrowserVoice(text, onDone);
    }
  };

  useEffect(() => stopAssistantSpeech, [stopAssistantSpeech]);

  return {
    aiSpeakingSeedRef,
    aiSpeakingStartedAtRef,
    isAssistantSpeaking,
    isAssistantSpeakingRef,
    speakOutLoud,
    stopAssistantSpeech,
  };
}

