"use client";

import { useEffect, useRef, useState } from "react";
import { normalizeLang } from "@/lib/speaking/browser-voices";

export function useBrowserVoices() {
  const browserVoicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const [availableAccentLangs, setAvailableAccentLangs] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      browserVoicesRef.current = voices;
      setAvailableAccentLangs(new Set(voices.map((voice) => normalizeLang(voice.lang))));
    };

    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
    };
  }, []);

  return {
    availableAccentLangs,
    browserVoicesRef,
  };
}

