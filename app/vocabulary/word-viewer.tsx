"use client";

import { useState } from "react";

import type { WordRow } from "@/lib/mysql";
import styles from "./page.module.css";

type WordViewerProps = {
  currentWord: WordRow;
  previousWord: WordRow | null;
  nextWord: WordRow | null;
};

const EXIT_MS = 240;
const ENTER_MS = 240;

type VocabularyPayload = {
  currentWord: WordRow;
  previousWord: WordRow | null;
  nextWord: WordRow | null;
};

type NavigationDirection = "previous" | "next";

export default function WordViewer({ currentWord, previousWord, nextWord }: WordViewerProps) {
  const [state, setState] = useState<VocabularyPayload>({
    currentWord,
    previousWord,
    nextWord,
  });
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [wordCardClass, setWordCardClass] = useState("");
  const [clientError, setClientError] = useState<string | null>(null);

  const loadWordWithAnimation = async (targetWord: string, direction: NavigationDirection) => {
    if (isTransitioning) return;
    setClientError(null);
    setIsTransitioning(true);
    setWordCardClass(direction === "next" ? styles.wordCardExitToLeft : styles.wordCardExitToRight);

    window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/vocabulary?word=${encodeURIComponent(targetWord)}`, {
          method: "GET",
          cache: "no-store",
        });
        const payload = (await response.json()) as VocabularyPayload & { error?: string };

        if (!response.ok) {
          throw new Error(payload.error ?? "Failed to load word.");
        }

        setState({
          currentWord: payload.currentWord,
          previousWord: payload.previousWord,
          nextWord: payload.nextWord,
        });
        window.history.replaceState(null, "", `/vocabulary?word=${encodeURIComponent(payload.currentWord.word)}`);
        setWordCardClass(direction === "next" ? styles.wordCardEnterFromRight : styles.wordCardEnterFromLeft);

        window.setTimeout(() => {
          setWordCardClass("");
          setIsTransitioning(false);
        }, ENTER_MS);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load word.";
        setClientError(message);
        setWordCardClass("");
        setIsTransitioning(false);
      }
    }, EXIT_MS);
  };

  return (
    <>
      <div className={styles.wordDeck} aria-live="polite">
        <button
          type="button"
          className={`${styles.sideWordCard} ${styles.sideWordCardPrevious}`}
          onClick={() => state.previousWord && loadWordWithAnimation(state.previousWord.word, "previous")}
          disabled={!state.previousWord || isTransitioning}
          aria-label={state.previousWord ? `Previous word: ${state.previousWord.word}` : "No previous word"}
        >
          <span className={styles.sideCardLabel}>Prev</span>
          <span className={styles.sideCardWord}>{state.previousWord?.word ?? ""}</span>
        </button>

        <div className={`${styles.wordCardBase} ${wordCardClass}`}>
          <div className={styles.wordText}>{state.currentWord.word}</div>
          <p className={styles.translationText}>{state.currentWord.translation ?? ""}</p>
        </div>

        <button
          type="button"
          className={`${styles.sideWordCard} ${styles.sideWordCardNext}`}
          onClick={() => state.nextWord && loadWordWithAnimation(state.nextWord.word, "next")}
          disabled={!state.nextWord || isTransitioning}
          aria-label={state.nextWord ? `Next word: ${state.nextWord.word}` : "No next word"}
        >
          <span className={styles.sideCardLabel}>Next</span>
          <span className={styles.sideCardWord}>{state.nextWord?.word ?? ""}</span>
        </button>
      </div>

      <div className={styles.navRow}>
        {state.previousWord ? (
          <button
            type="button"
            className={`${styles.navButton} ${styles.navButtonPrevious}`}
            onClick={() => state.previousWord && loadWordWithAnimation(state.previousWord.word, "previous")}
            disabled={isTransitioning}
          >
            Prev
          </button>
        ) : (
          <span className={styles.navButtonDisabled}>
            Prev
          </span>
        )}

        {state.nextWord ? (
          <button
            type="button"
            className={`${styles.navButton} ${styles.navButtonNext}`}
            onClick={() => state.nextWord && loadWordWithAnimation(state.nextWord.word, "next")}
            disabled={isTransitioning}
          >
            Next
          </button>
        ) : (
          <span className={styles.navButtonDisabled}>
            Next
          </span>
        )}
      </div>

      {clientError ? (
        <p className={styles.clientError}>{clientError}</p>
      ) : null}
    </>
  );
}
