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

export default function WordViewer({ currentWord, previousWord, nextWord }: WordViewerProps) {
  const [state, setState] = useState<VocabularyPayload>({
    currentWord,
    previousWord,
    nextWord,
  });
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [wordCardClass, setWordCardClass] = useState(styles.wordCardEnterFromRight);
  const [clientError, setClientError] = useState<string | null>(null);

  const loadWordWithAnimation = async (targetWord: string) => {
    if (isTransitioning) return;
    setClientError(null);
    setIsTransitioning(true);
    setWordCardClass(styles.wordCardExitToLeft);

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
        setWordCardClass(styles.wordCardEnterFromRight);

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
      <div
        className={`${styles.wordCardBase} ${wordCardClass}`}
        style={{
          padding: 24,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 56, fontWeight: 700, lineHeight: 1.1 }}>{state.currentWord.word}</div>
        <p style={{ marginTop: 12, color: "#444", minHeight: 24 }}>{state.currentWord.translation ?? ""}</p>
      </div>

      <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 18 }}>
        {state.previousWord ? (
          <button
            type="button"
            className={styles.navButton}
            style={{
              padding: "12px 22px",
              border: "1px solid #1f2937",
              borderRadius: 10,
              color: "#111827",
              fontWeight: 600,
              background: "#e5efff",
              cursor: "pointer",
            }}
            onClick={() => state.previousWord && loadWordWithAnimation(state.previousWord.word)}
            disabled={isTransitioning}
          >
            Prev
          </button>
        ) : (
          <span
            style={{
              padding: "12px 22px",
              border: "1px solid #c5c7cb",
              borderRadius: 10,
              color: "#9ca3af",
              fontWeight: 600,
              background: "#f3f4f6",
            }}
          >
            Prev
          </span>
        )}

        {state.nextWord ? (
          <button
            type="button"
            className={styles.navButton}
            style={{
              padding: "12px 22px",
              border: "1px solid #1f2937",
              borderRadius: 10,
              color: "#111827",
              fontWeight: 600,
              background: "#eaf8eb",
              cursor: "pointer",
            }}
            onClick={() => state.nextWord && loadWordWithAnimation(state.nextWord.word)}
            disabled={isTransitioning}
          >
            Next
          </button>
        ) : (
          <span
            style={{
              padding: "12px 22px",
              border: "1px solid #c5c7cb",
              borderRadius: 10,
              color: "#9ca3af",
              fontWeight: 600,
              background: "#f3f4f6",
            }}
          >
            Next
          </span>
        )}
      </div>

      {clientError ? (
        <p style={{ marginTop: 12, textAlign: "center", color: "#b42318", fontWeight: 600 }}>{clientError}</p>
      ) : null}
    </>
  );
}
