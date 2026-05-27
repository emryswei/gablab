"use client";

import { useEffect, useRef, useState } from "react";
import {
  CANTONESE_LOCALE,
  type AssistantVoiceLocale,
  type CantoneseVoice,
  type EnglishAccent,
  type SpeakingLanguage,
} from "@/lib/speaking/browser-voices";
import AccentSelector from "./accent-selector";
import CantoneseVoiceSelector from "./cantonese-voice-selector";
import LanguageSelector from "./language-selector";
import styles from "./speaking-coach.module.css";
import { useAssistantSpeech } from "./use-assistant-speech";
import { useBrowserVoices } from "./use-browser-voices";
import { useMicVisualizer } from "./use-mic-visualizer";
import { useSenseVoiceStt } from "./use-sensevoice-stt";

type CoachResponse = {
  reply?: string;
  corrected?: string;
  feedback?: string;
  followUpQuestion?: string;
  coachReply?: string;
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

const SILENCE_MS = 1200;
const NO_INPUT_PROMPT_MS = 15000;
const NO_INPUT_CONFIRM_MS = 3000;
const LANGUAGE_COPY = {
  english: {
    greeting: "Hi, this is your English speaking assistant.",
    noInputPrompt: "Are you still there?",
    goodbye: "Okay, bye. Talk to you next time.",
    noResponse: "No response detected. Conversation ended.",
    assistantLabel: "AI reply:",
    correctionLabel: "Try saying",
    feedbackLabel: "Coach tip",
    followUpLabel: "Next question",
    userLabel: "You said",
  },
  cantonese: {
    greeting: "你好，我係你嘅廣東話練習助手。",
    noInputPrompt: "你仲喺唔喺度？",
    goodbye: "好啦，拜拜，下次再傾。",
    noResponse: "未收到回應，對話已結束。",
    assistantLabel: "AI 回覆：",
    correctionLabel: "可以咁講",
    feedbackLabel: "練習提示",
    followUpLabel: "下一題",
    userLabel: "你講咗",
  },
} as const;

export default function SpeakingCoach() {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const historyRef = useRef<ChatTurn[]>([]);
  const silenceTimerRef = useRef<number | null>(null);
  const noInputTimerRef = useRef<number | null>(null);
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
  const selectedLanguageRef = useRef<SpeakingLanguage>("english");
  const selectedVoiceLocaleRef = useRef<AssistantVoiceLocale>("en-GB");
  const selectedCantoneseVoiceRef = useRef<CantoneseVoice>("Tracy");
  const conversationSessionRef = useRef(0);

  const [isSpeechRecognitionSupported, setIsSpeechRecognitionSupported] = useState(false);
  const [isAudioCaptureSupported, setIsAudioCaptureSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [lastUserUtterance, setLastUserUtterance] = useState("");
  const [coachReply, setCoachReply] = useState<string | null>(null);
  const [corrected, setCorrected] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [followUpQuestion, setFollowUpQuestion] = useState<string | null>(null);
  const [history, setHistory] = useState<ChatTurn[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedAccent, setSelectedAccent] = useState<EnglishAccent>("en-GB");
  const [selectedCantoneseVoice, setSelectedCantoneseVoice] = useState<CantoneseVoice>("Tracy");
  const [selectedLanguage, setSelectedLanguage] = useState<SpeakingLanguage>("english");
  const displayedUserUtterance = `${transcript} ${interim}`.trim() || lastUserUtterance;
  const hasTextPanelContent = Boolean(coachReply || corrected || feedback || followUpQuestion || displayedUserUtterance || error);
  const copy = LANGUAGE_COPY[selectedLanguage];
  const { availableAccentLangs, browserVoicesRef } = useBrowserVoices();
  const {
    aiSpeakingSeedRef,
    aiSpeakingStartedAtRef,
    isAssistantSpeakingRef,
    speakOutLoud,
    stopAssistantSpeech,
  } = useAssistantSpeech({
    browserVoicesRef,
    selectedVoiceLocaleRef,
    selectedCantoneseVoiceRef,
    setError,
  });
  const { ensureMicVisualizer, visualizerCanvasRef } = useMicVisualizer({
    aiSpeakingSeedRef,
    aiSpeakingStartedAtRef,
    isAssistantSpeakingRef,
    isListeningRef,
    setError,
  });
  const { captureAndTranscribe, stopCapture } = useSenseVoiceStt();

  useEffect(() => {
    const speechWindow = window as WindowWithSpeechRecognition;
    setIsSpeechRecognitionSupported(Boolean(speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition));
    setIsAudioCaptureSupported(typeof navigator.mediaDevices?.getUserMedia === "function");
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
    return (
      normalized.includes("that's it") ||
      normalized.includes("thats it") ||
      normalized.includes("bye bye") ||
      normalized.includes("拜拜") ||
      normalized.includes("再見") ||
      normalized.includes("再见") ||
      normalized.includes("唔講")
    );
  };

  const scheduleNoInputTimer = (mode: "normal" | "confirm") => {
    clearNoInputTimer();
    const timeout = mode === "normal" ? NO_INPUT_PROMPT_MS : NO_INPUT_CONFIRM_MS;
    noInputTimerRef.current = window.setTimeout(() => {
      if (!conversationActiveRef.current || !isListeningRef.current || hasSpokenInTurnRef.current) return;

      if (mode === "normal") {
        stopRecognition();
        speakOutLoud(LANGUAGE_COPY[selectedLanguageRef.current].noInputPrompt, () => {
          if (conversationActiveRef.current) {
            void startListeningTurn("confirm");
          }
        });
        return;
      }

      endConversation(LANGUAGE_COPY[selectedLanguageRef.current].noResponse);
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
    stopCapture();
    isListeningRef.current = false;
    setIsListening(false);
  };

  const sendToCoach = async (utterance: string) => {
    if (!utterance.trim() || !conversationActiveRef.current) return;
    const requestSession = conversationSessionRef.current;
    const requestLanguage = selectedLanguageRef.current;
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/speaking/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          utterance,
          history: historyRef.current.slice(-8),
          language: requestLanguage,
        }),
      });

      const payload = (await response.json()) as CoachResponse & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to get AI coach response.");
      }

      const reply =
        payload.reply?.trim() ||
        payload.coachReply?.trim() ||
        (requestLanguage === "cantonese" ? "你今日過成點呀？" : "Tell me more about your day.");
      const question = payload.followUpQuestion?.trim() || null;
      const spokenReply = payload.coachReply?.trim() || `${reply} ${question ?? ""}`.trim();

      if (!conversationActiveRef.current || requestSession !== conversationSessionRef.current) {
        return;
      }

      const updatedHistory = [
        ...historyRef.current,
        { role: "user" as const, content: utterance },
        { role: "assistant" as const, content: spokenReply },
      ];
      historyRef.current = updatedHistory;
      setHistory(updatedHistory);
      setCoachReply(reply);
      setCorrected(payload.corrected?.trim() || null);
      setFeedback(payload.feedback?.trim() || null);
      setFollowUpQuestion(question);

      speakOutLoud(spokenReply, () => {
        if (conversationActiveRef.current && requestSession === conversationSessionRef.current) {
          void startListeningTurn("normal");
        }
      });
    } catch (err) {
      if (requestSession === conversationSessionRef.current) {
        setError(err instanceof Error ? err.message : "Failed to get AI coach response.");
      }
    } finally {
      if (requestSession === conversationSessionRef.current) {
        setIsLoading(false);
      }
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
      speakOutLoud(LANGUAGE_COPY[selectedLanguageRef.current].goodbye, () => {
        endConversation();
      });
      return;
    }

    setLastUserUtterance(userUtterance);
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
    const canCaptureSelectedLanguage =
      selectedLanguageRef.current === "cantonese" ? isAudioCaptureSupported : isSpeechRecognitionSupported;
    if (!canCaptureSelectedLanguage || !conversationActiveRef.current || isLoadingRef.current || isAssistantSpeakingRef.current) return;
    setError(null);
    currentTurnModeRef.current = mode;
    resetTurnBuffers();
    scheduleNoInputTimer(mode);
    const micStream = await ensureMicVisualizer();

    if (selectedLanguageRef.current === "cantonese") {
      if (!micStream) {
        return;
      }

      const session = conversationSessionRef.current;
      isListeningRef.current = true;
      setIsListening(true);
      try {
        const utterance = await captureAndTranscribe(micStream, {
          onSpeechStart: () => {
            hasSpokenInTurnRef.current = true;
            clearNoInputTimer();
          },
          onCaptureEnd: () => {
            isListeningRef.current = false;
            setIsListening(false);
          },
        });
        if (!utterance || session !== conversationSessionRef.current || !conversationActiveRef.current) {
          if (!utterance && session === conversationSessionRef.current && conversationActiveRef.current) {
            setError("SenseVoice could not recognize that phrase. Please try again.");
          }
          return;
        }

        turnFinalTextRef.current = utterance;
        setTranscript(utterance);
        finalizeTurn();
      } catch (err) {
        if (session === conversationSessionRef.current) {
          setError(err instanceof Error ? err.message : "Cantonese transcription failed.");
        }
      }
      return;
    }

    const speechWindow = window as WindowWithSpeechRecognition;
    const SpeechRecognitionCtor = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return;

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = selectedVoiceLocaleRef.current;
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
      isListeningRef.current = false;
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
      isListeningRef.current = false;
      setIsListening(false);
      if (recognitionRef.current === recognition) {
        recognitionRef.current = null;
      }
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
    try {
      recognition.start();
      isListeningRef.current = true;
      setIsListening(true);
    } catch (err) {
      recognitionRef.current = null;
      clearNoInputTimer();
      isListeningRef.current = false;
      setIsListening(false);
      setError(err instanceof Error ? err.message : "Speech recognition could not start. Try again.");
    }
  };

  const startConversation = (language: SpeakingLanguage = selectedLanguageRef.current) => {
    const canCaptureLanguage = language === "cantonese" ? isAudioCaptureSupported : isSpeechRecognitionSupported;
    if (!canCaptureLanguage) return;
    const session = conversationSessionRef.current + 1;
    conversationSessionRef.current = session;
    setError(null);
    setIsLoading(false);
    setCoachReply(null);
    setCorrected(null);
    setFeedback(null);
    setFollowUpQuestion(null);
    setLastUserUtterance("");
    setHistory([]);
    historyRef.current = [];
    resetTurnBuffers();
    conversationActiveRef.current = true;
    stopRecognition();

    speakOutLoud(LANGUAGE_COPY[language].greeting, () => {
      if (conversationActiveRef.current && session === conversationSessionRef.current) {
        void startListeningTurn("normal");
      }
    });
  };

  const handleLanguageChange = (language: SpeakingLanguage) => {
    if (language === selectedLanguageRef.current) return;
    if (language === "cantonese" && !isAudioCaptureSupported) {
      setError("This browser cannot record audio for Cantonese recognition.");
      return;
    }
    if (language === "english" && !isSpeechRecognitionSupported) {
      setError("This browser does not support English SpeechRecognition. Use Chrome or Edge.");
      return;
    }
    selectedLanguageRef.current = language;
    selectedVoiceLocaleRef.current = language === "cantonese" ? CANTONESE_LOCALE : selectedAccentRef.current;
    setSelectedLanguage(language);
    stopAssistantSpeech();
    stopRecognition();
    startConversation(language);
  };

  const handleAccentChange = (accent: EnglishAccent) => {
    selectedAccentRef.current = accent;
    setSelectedAccent(accent);
    if (selectedLanguageRef.current === "english") {
      selectedVoiceLocaleRef.current = accent;
    }
  };

  const handleCantoneseVoiceChange = (voice: CantoneseVoice) => {
    selectedCantoneseVoiceRef.current = voice;
    setSelectedCantoneseVoice(voice);
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
    if (isSpeechRecognitionSupported) {
      startConversation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSpeechRecognitionSupported]);

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

      {selectedLanguage === "english" && !isSpeechRecognitionSupported ? (
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
        <div className={styles.voiceControls}>
          <LanguageSelector selectedLanguage={selectedLanguage} onLanguageChange={handleLanguageChange} />
          {selectedLanguage === "english" ? (
            <AccentSelector
              availableAccentLangs={availableAccentLangs}
              selectedAccent={selectedAccent}
              onAccentChange={handleAccentChange}
            />
          ) : (
            <CantoneseVoiceSelector
              availableVoices={browserVoicesRef.current}
              selectedVoice={selectedCantoneseVoice}
              onVoiceChange={handleCantoneseVoiceChange}
            />
          )}
        </div>
      </div>

      {hasTextPanelContent ? (
        <div className={styles.textColumn}>
          {coachReply ? (
            <div className={styles.replyPanel}>
              <p>
                <strong>{copy.assistantLabel}</strong> {coachReply}
              </p>
              {followUpQuestion ? (
                <p className={styles.followUpQuestion}>
                  <strong>{copy.followUpLabel}:</strong> {followUpQuestion}
                </p>
              ) : null}
            </div>
          ) : null}

          {corrected || feedback ? (
            <div className={styles.coachingPanel}>
              {corrected ? (
                <p>
                  <strong>{copy.correctionLabel}:</strong> {corrected}
                </p>
              ) : null}
              {feedback ? (
                <p>
                  <strong>{copy.feedbackLabel}:</strong> {feedback}
                </p>
              ) : null}
            </div>
          ) : null}

          {displayedUserUtterance ? (
            <div className={styles.transcriptPanel}>
              <div className={styles.panelLabel}>{copy.userLabel}</div>
              <p>{displayedUserUtterance}</p>
            </div>
          ) : null}

          {error ? <p className={styles.errorText}>{error}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
