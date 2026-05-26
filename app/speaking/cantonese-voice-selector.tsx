"use client";

import {
  CANTONESE_LOCALE,
  CANTONESE_VOICE_OPTIONS,
  hasBrowserVoiceNamed,
  type BrowserVoice,
  type CantoneseVoice,
} from "@/lib/speaking/browser-voices";
import styles from "./speaking-coach.module.css";

type CantoneseVoiceSelectorProps = {
  availableVoices: BrowserVoice[];
  selectedVoice: CantoneseVoice;
  onVoiceChange: (voice: CantoneseVoice) => void;
};

export default function CantoneseVoiceSelector({
  availableVoices,
  selectedVoice,
  onVoiceChange,
}: CantoneseVoiceSelectorProps) {
  return (
    <div className={styles.cantoneseVoiceSelector} aria-label="Cantonese assistant voice">
      {CANTONESE_VOICE_OPTIONS.map((option) => {
        const isSelected = selectedVoice === option.voice;
        const isAvailable = hasBrowserVoiceNamed(availableVoices, CANTONESE_LOCALE, option.voice);
        return (
          <button
            key={option.voice}
            type="button"
            className={isSelected ? styles.cantoneseVoiceButtonActive : styles.cantoneseVoiceButton}
            aria-pressed={isSelected}
            title={isAvailable ? `${option.label} zh-HK` : `${option.label} unavailable; using zh-HK fallback`}
            onClick={() => onVoiceChange(option.voice)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
