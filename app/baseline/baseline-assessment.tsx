"use client";

import { CheckCircle2, Mic, Square } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { BASELINE_PROMPTS, createSpeakingBaseline } from "@/lib/learning/baseline";
import { INTRODUCING_YOURSELF_LESSON } from "@/lib/learning/courses";
import {
  DEFAULT_LEARNING_SETTINGS,
  hasCurrentPrivacyConsent,
  IndexedDbLearningRepository,
  loadLearningSettings,
  saveLearningSettings,
} from "@/lib/learning/storage";
import {
  LEARNING_SCHEMA_VERSION,
  PRIVACY_CONSENT_VERSION,
  type LearningSettings,
  type SpeakingBaseline,
} from "@/lib/learning/types";
import styles from "./page.module.css";

type SpeechRecognitionResult = {
  isFinal: boolean;
  0: { transcript: string };
};

type SpeechRecognitionEventLike = Event & {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResult>;
};

type SpeechRecognitionErrorEventLike = Event & {
  error: string;
};

type SpeechRecognitionLike = EventTarget & {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type WindowWithSpeechRecognition = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

function formatDuration(milliseconds: number) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default function BaselineAssessment() {
  const [repository] = useState(() => new IndexedDbLearningRepository());
  const [settings, setSettings] = useState<LearningSettings>(DEFAULT_LEARNING_SETTINGS);
  const [settingsReady, setSettingsReady] = useState(false);
  const [isSupported, setIsSupported] = useState<boolean | null>(null);
  const [responses, setResponses] = useState(() => BASELINE_PROMPTS.map(() => ""));
  const [currentPromptIndex, setCurrentPromptIndex] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [visibleTranscript, setVisibleTranscript] = useState("");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [baseline, setBaseline] = useState<SpeakingBaseline | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    const speechWindow = window as WindowWithSpeechRecognition;
    setSettings(loadLearningSettings());
    setSettingsReady(true);
    setIsSupported(Boolean(speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition));
    return () => recognitionRef.current?.stop();
  }, []);

  useEffect(() => {
    if (startedAt === null || baseline) return;
    const updateElapsed = () => setElapsedMs(Date.now() - startedAt);
    updateElapsed();
    const timer = window.setInterval(updateElapsed, 1000);
    return () => window.clearInterval(timer);
  }, [baseline, startedAt]);

  const acceptPrivacyConsent = () => {
    const acceptedSettings: LearningSettings = {
      ...settings,
      consentAcceptedAt: new Date().toISOString(),
      consentVersion: PRIVACY_CONSENT_VERSION,
    };
    saveLearningSettings(acceptedSettings);
    setSettings(acceptedSettings);
  };

  const startAnswer = () => {
    if (isListening || isSupported !== true) return;
    const speechWindow = window as WindowWithSpeechRecognition;
    const SpeechRecognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const promptIndex = currentPromptIndex;
    const recognition = new SpeechRecognition();
    let finalText = "";
    let interimText = "";
    let committed = false;

    const commitAnswer = () => {
      if (committed) return;
      committed = true;
      const response = `${finalText} ${interimText}`.trim();
      if (response) {
        setResponses((currentResponses) =>
          currentResponses.map((currentResponse, index) =>
            index === promptIndex ? response : currentResponse,
          ),
        );
        setCurrentPromptIndex(Math.min(promptIndex + 1, BASELINE_PROMPTS.length - 1));
      }
      setVisibleTranscript(response);
      recognitionRef.current = null;
      setIsListening(false);
    };

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = settings.preferredAccent;
    recognition.onresult = (event) => {
      interimText = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const transcript = event.results[index][0].transcript.trim();
        if (event.results[index].isFinal) {
          finalText = `${finalText} ${transcript}`.trim();
        } else {
          interimText = `${interimText} ${transcript}`.trim();
        }
      }
      setVisibleTranscript(`${finalText} ${interimText}`.trim());
    };
    recognition.onerror = (event) => {
      if (event.error !== "aborted" && event.error !== "no-speech") {
        setError(
          event.error === "not-allowed"
            ? "Microphone permission is required for the speaking baseline."
            : `Speech recognition error: ${event.error}`,
        );
      }
    };
    recognition.onend = commitAnswer;

    setError(null);
    setVisibleTranscript("");
    if (startedAt === null) setStartedAt(Date.now());
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setIsListening(true);
    } catch (startError) {
      recognitionRef.current = null;
      setError(startError instanceof Error ? startError.message : "Speech recognition could not start.");
    }
  };

  const stopAnswer = () => {
    recognitionRef.current?.stop();
  };

  const completeBaseline = async () => {
    if (responses.some((response) => !response.trim()) || startedAt === null || isSaving) return;
    setIsSaving(true);
    setError(null);
    try {
      const completedBaseline = createSpeakingBaseline({
        responses,
        startedAt: new Date(startedAt),
        recommendedLessonId: INTRODUCING_YOURSELF_LESSON.id,
      });
      const existingProfile = await repository.getProfile();
      await repository.saveProfile({
        schemaVersion: LEARNING_SCHEMA_VERSION,
        id: "local-profile",
        ...existingProfile,
        speakingBaseline: completedBaseline,
        updatedAt: new Date().toISOString(),
      });
      setBaseline(completedBaseline);
      setElapsedMs(completedBaseline.durationMs);
      setVisibleTranscript("");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Baseline could not be saved.");
    } finally {
      setIsSaving(false);
    }
  };

  const resetBaseline = () => {
    setResponses(BASELINE_PROMPTS.map(() => ""));
    setCurrentPromptIndex(0);
    setStartedAt(null);
    setElapsedMs(0);
    setBaseline(null);
    setVisibleTranscript("");
    setError(null);
  };

  if (!settingsReady) {
    return <p className={styles.statusText} role="status">Loading baseline...</p>;
  }

  if (!hasCurrentPrivacyConsent(settings)) {
    return (
      <section className={styles.consentPanel}>
        <span>Before your baseline</span>
        <h2>How your speaking data is used</h2>
        <ul>
          <li>Microphone audio is used for browser speech recognition and is not stored.</li>
          <li>Your four response transcripts remain in memory only while creating the baseline.</li>
          <li>Only derived counts, focus areas, and the recommended lesson are stored locally.</li>
          <li>You can export or delete this profile from the dashboard.</li>
        </ul>
        <div className={styles.consentActions}>
          <Button type="button" onClick={acceptPrivacyConsent}>I understand and continue</Button>
          <Button asChild variant="outline"><Link href="/">Back to dashboard</Link></Button>
        </div>
      </section>
    );
  }

  if (isSupported === false) {
    return (
      <section className={styles.unsupportedPanel}>
        <h2>Speech recognition is unavailable</h2>
        <p>Use desktop Chrome or Edge to complete the English speaking baseline.</p>
      </section>
    );
  }

  if (baseline) {
    return (
      <section className={styles.resultPanel} aria-labelledby="baseline-result-title">
        <CheckCircle2 size={30} aria-hidden="true" />
        <div>
          <span>Starting profile saved</span>
          <h2 id="baseline-result-title">Your first lesson is ready</h2>
          <p>
            You completed {baseline.responseCount} prompts and used {baseline.totalWordCount} words,
            averaging {baseline.averageWordsPerResponse} words per response. This is a starting point,
            not a score.
          </p>
        </div>
        <div className={styles.resultFocus}>
          <h3>Practice focus</h3>
          <ul>{baseline.focusAreas.map((focus) => <li key={focus}>{focus}</li>)}</ul>
        </div>
        <div className={styles.resultActions}>
          <Link href={`/speaking?lesson=${baseline.recommendedLessonId}`}>Start recommended lesson</Link>
          <button type="button" onClick={resetBaseline}>Retake baseline</button>
        </div>
      </section>
    );
  }

  const completedCount = responses.filter(Boolean).length;
  const allPromptsComplete = completedCount === BASELINE_PROMPTS.length;
  const currentPrompt = BASELINE_PROMPTS[currentPromptIndex];

  return (
    <section className={styles.assessmentPanel} aria-labelledby="baseline-prompt-title">
      <div className={styles.assessmentHeader}>
        <div>
          <span>3-5 minute starting profile</span>
          <h2>Speak naturally. This is not a test.</h2>
        </div>
        <strong>{formatDuration(elapsedMs)}</strong>
      </div>

      <div className={styles.promptProgress} aria-label="Baseline prompt progress">
        {BASELINE_PROMPTS.map((prompt, index) => (
          <button
            key={prompt.id}
            type="button"
            className={index === currentPromptIndex ? styles.promptActive : undefined}
            onClick={() => !isListening && setCurrentPromptIndex(index)}
            aria-label={`${prompt.title}${responses[index] ? ", completed" : ""}`}
          >
            {responses[index] ? <CheckCircle2 size={16} aria-hidden="true" /> : index + 1}
          </button>
        ))}
      </div>

      <div className={styles.promptCard}>
        <span>Prompt {currentPromptIndex + 1} of {BASELINE_PROMPTS.length}</span>
        <h3 id="baseline-prompt-title">{currentPrompt.title}</h3>
        <p>{currentPrompt.prompt}</p>
        <small>Aim for about 30-60 seconds. You can re-record before finishing.</small>
      </div>

      <div className={styles.transcriptBox} aria-live="polite">
        {visibleTranscript || responses[currentPromptIndex] || "Your words will appear here while you speak."}
      </div>

      <div className={styles.assessmentActions}>
        {isListening ? (
          <Button type="button" variant="destructive" onClick={stopAnswer}>
            <Square size={16} aria-hidden="true" /> Stop answer
          </Button>
        ) : (
          <Button type="button" onClick={startAnswer}>
            <Mic size={16} aria-hidden="true" /> {responses[currentPromptIndex] ? "Record again" : "Start answer"}
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          disabled={!allPromptsComplete || isListening || isSaving}
          onClick={() => void completeBaseline()}
        >
          {isSaving ? "Saving..." : `Finish baseline (${completedCount}/${BASELINE_PROMPTS.length})`}
        </Button>
      </div>
      {error ? <p className={styles.errorText} role="alert">{error}</p> : null}
    </section>
  );
}
