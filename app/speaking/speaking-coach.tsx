"use client";

import { useEffect, useRef, useState } from "react";
import type { EnglishAccent } from "@/lib/speaking/browser-voices";
import AccentSelector from "./accent-selector";
import styles from "./speaking-coach.module.css";
import { useAssistantSpeech } from "./use-assistant-speech";
import { useBrowserVoices } from "./use-browser-voices";
import { useMicVisualizer } from "./use-mic-visualizer";

type CoachResponse = {
  coachReply: string;
};

type ChatTurn = {
  role: "user" | "assistant";
  content: string;
};

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
  message?: string;
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

const GREETING = "Hi, this is your english speaking assistant.";
const SILENCE_MS = 1200;
const NO_INPUT_PROMPT_MS = 15000;
const NO_INPUT_CONFIRM_MS = 3000;
const ARE_YOU_THERE_PROMPT = "Are you still there?";
const GOODBYE_MESSAGE = "Okay, bye. Talk to you next time.";

export default function SpeakingCoach() {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const historyRef = useRef<ChatTurn[]>([]);
  const silenceTimerRef = useRef<number | null>(null);
  const noInputTimerRef = useRef<number | null>(null);
  const startedRef = useRef(false);
  const turnFinalTextRef = useRef("");
  const turnInterimTextRef = useRef("");
  const hasSpokenInTurnRef = useRef(false);
  const finalizedRef = useRef(false);
  const conversationActiveRef = useRef(false);
  const intentionalStopRef = useRef(false);
  const currentTurnModeRef = useRef<"normal" | "confirm">("normal");
  const isListeningRef = useRef(false);
  const isLoadingRef = useRef(false);
  const selectedAccentRef = useRef<EnglishAccent>("en-GB");

  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [coachReply, setCoachReply] = useState<string | null>(null);
  const [history, setHistory] = useState<ChatTurn[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedAccent, setSelectedAccent] = useState<EnglishAccent>("en-GB");
  const hasTextPanelContent = Boolean(coachReply || transcript || interim || error);
  const { availableAccentLangs, browserVoicesRef } = useBrowserVoices();
  const {
    aiSpeakingSeedRef,
    aiSpeakingStartedAtRef,
    isAssistantSpeaking,
    isAssistantSpeakingRef,
    speakOutLoud,
    stopAssistantSpeech,
  } = useAssistantSpeech({
    browserVoicesRef,
    selectedAccentRef,
    setError,
  });
  const { ensureMicVisualizer, visualizerCanvasRef } = useMicVisualizer({
    aiSpeakingSeedRef,
    aiSpeakingStartedAtRef,
    isAssistantSpeakingRef,
    isListeningRef,
    setError,
  });

  useEffect(() => {
    const speechWindow = window as WindowWithSpeechRecognition;
    setIsSupported(Boolean(speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition));
  }, []);

  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);

  useEffect(() => {
    selectedAccentRef.current = selectedAccent;
  }, [selectedAccent]);

  const clearSilenceTimer = () => {
    if (silenceTimerRef.current !== null) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  };

  const clearNoInputTimer = () => {
    if (noInputTimerRef.current !== null) {
      window.clearTimeout(noInputTimerRef.current);
      noInputTimerRef.current = null;
    }
  };

  const isExitCommand = (text: string) => {
    const normalized = text.toLowerCase();
    return normalized.includes("that's it") || normalized.includes("thats it") || normalized.includes("bye bye");
  };

  const scheduleNoInputTimer = (mode: "normal" | "confirm") => {
    clearNoInputTimer();
    const timeout = mode === "normal" ? NO_INPUT_PROMPT_MS : NO_INPUT_CONFIRM_MS;
    noInputTimerRef.current = window.setTimeout(() => {
      if (!conversationActiveRef.current || !isListeningRef.current || hasSpokenInTurnRef.current) return;

      if (mode === "normal") {
        stopRecognition();
        speakOutLoud(ARE_YOU_THERE_PROMPT, () => {
          if (conversationActiveRef.current) {
            void startListeningTurn("confirm");
          }
        });
        return;
      }

      endConversation("No response detected. Conversation ended.");
    }, timeout);
  };

  const resetTurnBuffers = () => {
    turnFinalTextRef.current = "";
    turnInterimTextRef.current = "";
    hasSpokenInTurnRef.current = false;
    finalizedRef.current = false;
    setTranscript("");
    setInterim("");
  };

  const stopRecognition = () => {
    clearSilenceTimer();
    clearNoInputTimer();
    intentionalStopRef.current = true;
    recognitionRef.current?.stop();
    setIsListening(false);
  };

  const sendToCoach = async (utterance: string) => {
    if (!utterance.trim() || !conversationActiveRef.current) return;
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/speaking/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          utterance,
          history: historyRef.current.slice(-8),
        }),
      });

      const payload = (await response.json()) as CoachResponse & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to get AI coach response.");
      }

      const parsed: CoachResponse = {
        coachReply: payload.coachReply ?? "Tell me more about your day.",
      };

      if (!conversationActiveRef.current) {
        return;
      }

      const updatedHistory = [
        ...historyRef.current,
        { role: "user" as const, content: utterance },
        { role: "assistant" as const, content: parsed.coachReply },
      ];
      historyRef.current = updatedHistory;
      setHistory(updatedHistory);
      setCoachReply(parsed.coachReply);

      speakOutLoud(parsed.coachReply, () => {
        if (conversationActiveRef.current) {
          void startListeningTurn("normal");
        }
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get AI coach response.");
    } finally {
      setIsLoading(false);
    }
  };

  const finalizeTurn = () => {
    if (finalizedRef.current) return;
    finalizedRef.current = true;
    stopRecognition();
    const userUtterance = `${turnFinalTextRef.current} ${turnInterimTextRef.current}`.trim();
    if (!userUtterance) {
      if (conversationActiveRef.current) {
        void startListeningTurn(currentTurnModeRef.current);
      }
      return;
    }

    if (isExitCommand(userUtterance)) {
      stopRecognition();
      speakOutLoud(GOODBYE_MESSAGE, () => {
        endConversation();
      });
      return;
    }

    sendToCoach(userUtterance);
  };

  const scheduleSilenceFinalize = () => {
    clearSilenceTimer();
    silenceTimerRef.current = window.setTimeout(() => {
      if (hasSpokenInTurnRef.current) {
        finalizeTurn();
      }
    }, SILENCE_MS);
  };

  const startListeningTurn = async (mode: "normal" | "confirm" = "normal") => {
    if (!isSupported || !conversationActiveRef.current || isLoading || isAssistantSpeaking) return;
    setError(null);
    currentTurnModeRef.current = mode;
    resetTurnBuffers();
    scheduleNoInputTimer(mode);
    await ensureMicVisualizer();

    const speechWindow = window as WindowWithSpeechRecognition;
    const SpeechRecognitionCtor = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return;

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = selectedAccentRef.current;
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      let finalChunk = "";
      let interimChunk = "";

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) {
          finalChunk += result[0].transcript;
        } else {
          interimChunk += result[0].transcript;
        }
      }

      if (finalChunk || interimChunk) {
        hasSpokenInTurnRef.current = true;
        clearNoInputTimer();
      }

      if (finalChunk) {
        turnFinalTextRef.current = `${turnFinalTextRef.current} ${finalChunk}`.trim();
        setTranscript(turnFinalTextRef.current);
      }

      turnInterimTextRef.current = interimChunk.trim();
      setInterim(turnInterimTextRef.current);

      if (hasSpokenInTurnRef.current) {
        scheduleSilenceFinalize();
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
      clearSilenceTimer();
      setIsListening(false);
      const errorCode = event.error;

      if (
        intentionalStopRef.current ||
        finalizedRef.current ||
        errorCode === "aborted" ||
        errorCode === "no-speech"
      ) {
        return;
      }

      if (errorCode === "not-allowed" || errorCode === "service-not-allowed" || errorCode === "audio-capture") {
        setError("Speech recognition failed. Check microphone permission and try again.");
        return;
      }

      setError(`Speech recognition error: ${errorCode}`);
    };

    recognition.onend = () => {
      clearSilenceTimer();
      clearNoInputTimer();
      setIsListening(false);
      const wasIntentionalStop = intentionalStopRef.current;
      intentionalStopRef.current = false;

      if (wasIntentionalStop || finalizedRef.current) return;

      if (!conversationActiveRef.current || isLoadingRef.current || isAssistantSpeakingRef.current) return;

      if (hasSpokenInTurnRef.current && !finalizedRef.current) {
        finalizeTurn();
        return;
      }

      window.setTimeout(() => {
        if (conversationActiveRef.current && !isLoadingRef.current && !isAssistantSpeakingRef.current) {
          void startListeningTurn(currentTurnModeRef.current);
        }
      }, 250);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  const startConversation = () => {
    if (!isSupported) return;
    setError(null);
    setCoachReply(null);
    setHistory([]);
    historyRef.current = [];
    conversationActiveRef.current = true;
    stopRecognition();

    speakOutLoud(GREETING, () => {
      if (conversationActiveRef.current) {
        void startListeningTurn("normal");
      }
    });
  };

  const endConversation = (message?: string) => {
    conversationActiveRef.current = false;
    stopRecognition();
    stopAssistantSpeech();
    setIsLoading(false);
    if (message) {
      setError(message);
    }
  };

  useEffect(() => {
    if (isSupported && !startedRef.current) {
      startedRef.current = true;
      startConversation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSupported]);

  useEffect(() => {
    return () => {
      conversationActiveRef.current = false;
      clearSilenceTimer();
      clearNoInputTimer();
      recognitionRef.current?.stop();
    };
  }, []);

  return (
    <section className={hasTextPanelContent ? styles.speakingLayout : styles.speakingLayoutSolo}>
      {/* <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Button type="button" onClick={startConversation} disabled={!isSupported || isLoading}>
          Restart Conversation
        </Button>
        <Button type="button" variant="outline" onClick={() => endConversation()} disabled={!isConversationActive}>
          End Conversation
        </Button>
      </div> */}

      {!isSupported ? (
        <p style={{ marginTop: 12, color: "#b42318" }}>
          Your browser does not support SpeechRecognition. Use Chrome/Edge for voice input.
        </p>
      ) : null}

      <div className={styles.visualColumn}>
        <canvas
          ref={visualizerCanvasRef}
          className={styles.spectrogramCanvas}
          width={360}
          height={360}
          aria-hidden="true"
        />
        <AccentSelector
          availableAccentLangs={availableAccentLangs}
          selectedAccent={selectedAccent}
          onAccentChange={setSelectedAccent}
        />
      </div>

      {hasTextPanelContent ? (
        <div className={styles.textColumn}>
          {coachReply ? (
            <div className={styles.replyPanel}>
              <p>
                <strong>AI reply:</strong> {coachReply}
              </p>
            </div>
          ) : null}

          {transcript || interim ? (
            <div className={styles.transcriptPanel}>
              <div className={styles.panelLabel}>You said</div>
              <p>{`${transcript} ${interim}`.trim()}</p>
            </div>
          ) : null}

          {error ? <p className={styles.errorText}>{error}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
