"use client";

import { ENGLISH_ACCENT_OPTIONS, hasBrowserVoiceForAccent, type EnglishAccent } from "@/lib/speaking/browser-voices";
import styles from "./speaking-coach.module.css";

type AccentSelectorProps = {
  availableAccentLangs: Set<string>;
  selectedAccent: EnglishAccent;
  onAccentChange: (accent: EnglishAccent) => void;
};

export default function AccentSelector({
  availableAccentLangs,
  selectedAccent,
  onAccentChange,
}: AccentSelectorProps) {
  return (
    <div className={styles.accentSelector} aria-label="Assistant accent">
      {ENGLISH_ACCENT_OPTIONS.map((option) => {
        const isSelected = selectedAccent === option.lang;
        const isAvailable = hasBrowserVoiceForAccent(availableAccentLangs, option.lang);
        return (
          <button
            key={option.lang}
            type="button"
            className={isSelected ? styles.accentButtonActive : styles.accentButton}
            aria-pressed={isSelected}
            title={isAvailable ? option.lang : `${option.lang} fallback`}
            onClick={() => onAccentChange(option.lang)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

