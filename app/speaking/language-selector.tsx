"use client";

import type { SpeakingLanguage } from "@/lib/speaking/browser-voices";
import styles from "./speaking-coach.module.css";

type LanguageSelectorProps = {
  selectedLanguage: SpeakingLanguage;
  onLanguageChange: (language: SpeakingLanguage) => void;
};

const LANGUAGE_OPTIONS: Array<{ label: string; language: SpeakingLanguage }> = [
  { label: "English", language: "english" },
  { label: "粤语", language: "cantonese" },
];

export default function LanguageSelector({ selectedLanguage, onLanguageChange }: LanguageSelectorProps) {
  return (
    <div className={styles.languageSelector} aria-label="Practice language">
      {LANGUAGE_OPTIONS.map((option) => {
        const isSelected = selectedLanguage === option.language;
        return (
          <button
            key={option.language}
            type="button"
            className={isSelected ? styles.languageButtonActive : styles.languageButton}
            aria-pressed={isSelected}
            onClick={() => onLanguageChange(option.language)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
