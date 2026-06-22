"use client";

import { Pause, Play, SkipForward, Square, Volume2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  CANTONESE_LOCALE,
  type AssistantVoiceLocale,
  type CantoneseVoice,
  type EnglishAccent,
  type SpeakingLanguage,
} from "@/lib/speaking/browser-voices";
import { getLessonById } from "@/lib/learning/courses";
import {
  appendSessionTurn,
  createPracticeSession,
  endPracticeSession,
  pausePracticeSession,
  resumePracticeSession,
} from "@/lib/learning/session";
import {
  DEFAULT_LEARNING_SETTINGS,
  hasCurrentPrivacyConsent,
  IndexedDbLearningRepository,
  loadLearningSettings,
  saveLearningSettings,
} from "@/lib/learning/storage";
import {
  PRIVACY_CONSENT_VERSION,
  LEARNING_SCHEMA_VERSION,
  type LearningSettings,
  type PracticeReport,
  type PracticeSession,
  type SessionStatus,
} from "@/lib/learning/types";
import { Button } from "@/components/ui/button";
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
  const learningSessionRef = useRef<PracticeSession | null>(null);
  const learningRepositoryRef = useRef<IndexedDbLearningRepository | null>(null);

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
  const [lessonId, setLessonId] = useState<string | undefined>();
  const [requestedSessionId, setRequestedSessionId] = useState<string | undefined>();
  const [routeContextReady, setRouteContextReady] = useState(false);
  const [learningSessionReady, setLearningSessionReady] = useState(false);
  const [practiceStatus, setPracticeStatus] = useState<SessionStatus | null>(null);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  const [practiceReport, setPracticeReport] = useState<PracticeReport | null>(null);
  const [isReportLoading, setIsReportLoading] = useState(false);
  const [settingsReady, setSettingsReady] = useState(false);
  const [learningSettings, setLearningSettings] = useState<LearningSettings>(DEFAULT_LEARNING_SETTINGS);
  const [learnerName, setLearnerName] = useState("");
  const [englishGoal, setEnglishGoal] = useState("");
  const displayedUserUtterance = `${transcript} ${interim}`.trim() || lastUserUtterance;
  const lesson = lessonId ? getLessonById(lessonId) : undefined;
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
    const searchParams = new URLSearchParams(window.location.search);
    setLessonId(searchParams.get("lesson") ?? undefined);
    setRequestedSessionId(searchParams.get("session") ?? undefined);
    setRouteContextReady(true);
    const settings = loadLearningSettings();
    setLearningSettings(settings);
    const repository = new IndexedDbLearningRepository();
    learningRepositoryRef.current = repository;
    void repository.getProfile().then((profile) => {
      setLearnerName(profile?.learnerName ?? "");
      setEnglishGoal(profile?.englishGoal ?? "");
    }).catch(() => setStorageAvailable(false));
    setSettingsReady(true);
    setIsSpeechRecognitionSupported(Boolean(speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition));
    setIsAudioCaptureSupported(typeof navigator.mediaDevices?.getUserMedia === "function");
  }, []);

  useEffect(() => {
    if (!routeContextReady || !settingsReady) return;
    if (!lesson) {
      setLearningSessionReady(true);
      return;
    }
    if (!hasCurrentPrivacyConsent(learningSettings)) {
      setLearningSessionReady(false);
      return;
    }

    let cancelled = false;
    const repository = new IndexedDbLearningRepository();
    learningRepositoryRef.current = repository;

    const initializeLearningSession = async () => {
      try {
        const storedSession = requestedSessionId
          ? await repository.getSession(requestedSessionId)
          : undefined;
        const canResume =
          storedSession &&
          storedSession.lessonId === lesson.id &&
          storedSession.status !== "completed";
        const session = canResume
          ? pausePracticeSession(storedSession)
          : pausePracticeSession(
              createPracticeSession({
                id: crypto.randomUUID(),
                lesson,
                mode: "standard",
                modelId: "configured-coach-model",
              }),
            );
        await repository.saveSession(session);
        if (cancelled) return;

        learningSessionRef.current = session;
        const restoredHistory = session.turns.map((turn) => ({
          role: turn.role,
          content: turn.content,
        }));
        historyRef.current = restoredHistory;
        setHistory(restoredHistory);
        setPracticeStatus(session.status);
        setPracticeReport(session.report ?? null);
      } catch {
        if (cancelled) return;
        const session = pausePracticeSession(
          createPracticeSession({
            id: crypto.randomUUID(),
            lesson,
            mode: "standard",
            modelId: "configured-coach-model",
          }),
        );
        learningSessionRef.current = session;
        setPracticeStatus(session.status);
        setStorageAvailable(false);
      } finally {
        if (!cancelled) setLearningSessionReady(true);
      }
    };

    void initializeLearningSession();
    return () => {
      cancelled = true;
    };
  }, [learningSettings, lesson, requestedSessionId, routeContextReady, settingsReady]);

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

  const checkpointLearningSession = (session: PracticeSession) => {
    learningSessionRef.current = session;
    setPracticeStatus(session.status);
    const repository = learningRepositoryRef.current;
    if (!repository) return;
    void repository.saveSession(session).catch(() => setStorageAvailable(false));
  };

  const sendToCoach = async (utterance: string, { skipQuestion = false } = {}) => {
    if ((!utterance.trim() && !skipQuestion) || !conversationActiveRef.current) return;
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
          lessonId,
          skipQuestion,
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
        ...(skipQuestion ? [] : [{ role: "user" as const, content: utterance }]),
        { role: "assistant" as const, content: spokenReply },
      ];
      historyRef.current = updatedHistory;
      setHistory(updatedHistory);
      setCoachReply(reply);
      setCorrected(payload.corrected?.trim() || null);
      setFeedback(payload.feedback?.trim() || null);
      setFollowUpQuestion(question);

      if (lesson && learningSessionRef.current) {
        const now = new Date();
        const sessionWithUserTurn = skipQuestion
          ? learningSessionRef.current
          : appendSessionTurn(learningSessionRef.current, {
              id: crypto.randomUUID(),
              role: "user",
              content: utterance,
              createdAt: now.toISOString(),
              ...(payload.corrected ? { corrected: payload.corrected } : {}),
              ...(payload.feedback ? { feedback: payload.feedback } : {}),
            }, now);
        const assistantTurn = appendSessionTurn(sessionWithUserTurn, {
          id: crypto.randomUUID(),
          role: "assistant",
          content: spokenReply,
          createdAt: now.toISOString(),
        }, now);
        checkpointLearningSession(assistantTurn);
      }

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
    const learningSession = learningSessionRef.current;
    if (lesson && learningSession && learningSession.status !== "in_progress") {
      checkpointLearningSession(resumePracticeSession(learningSession));
    }
    setError(null);
    setIsLoading(false);
    setCoachReply(null);
    setCorrected(null);
    setFeedback(null);
    setFollowUpQuestion(null);
    setLastUserUtterance("");
    const restoredHistory = lesson && learningSessionRef.current
      ? learningSessionRef.current.turns.map((turn) => ({ role: turn.role, content: turn.content }))
      : [];
    setHistory(restoredHistory);
    historyRef.current = restoredHistory;
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
    if (lesson && learningSessionRef.current) {
      const endedSession = endPracticeSession(learningSessionRef.current, lesson);
      checkpointLearningSession(endedSession);
      void requestLessonReport(endedSession);
      setSessionNotice(
        endedSession.status === "completed"
          ? "Lesson completed and saved."
          : "Lesson saved as incomplete. You can continue it from the dashboard.",
      );
    } else if (message) {
      setError(message);
    }
  };

  const requestLessonReport = async (session: PracticeSession) => {
    setIsReportLoading(true);
    try {
      const response = await fetch("/api/speaking/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session }),
      });
      const payload = (await response.json()) as PracticeReport & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Unable to generate lesson report.");
      const sessionWithReport = { ...session, report: payload };
      checkpointLearningSession(sessionWithReport);
      setPracticeReport(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to generate lesson report.");
    } finally {
      setIsReportLoading(false);
    }
  };

  const pauseLesson = () => {
    if (!lesson || !learningSessionRef.current || practiceStatus !== "in_progress") return;
    conversationActiveRef.current = false;
    conversationSessionRef.current += 1;
    stopRecognition();
    stopAssistantSpeech();
    setIsLoading(false);
    checkpointLearningSession(pausePracticeSession(learningSessionRef.current));
    setSessionNotice("Lesson paused and saved.");
  };

  const resumeLesson = () => {
    if (!lesson || !learningSessionRef.current || practiceStatus === "completed") return;
    if (!isSpeechRecognitionSupported) {
      setError("This browser does not support English SpeechRecognition. Use Chrome or Edge.");
      return;
    }
    const resumedSession = resumePracticeSession(learningSessionRef.current);
    checkpointLearningSession(resumedSession);
    setSessionNotice(null);
    conversationSessionRef.current += 1;
    conversationActiveRef.current = true;
    void startListeningTurn("normal");
  };

  const replayAssistantReply = () => {
    const spokenReply = `${coachReply ?? ""} ${followUpQuestion ?? ""}`.trim();
    if (!spokenReply || practiceStatus !== "in_progress") return;
    stopRecognition();
    speakOutLoud(spokenReply, () => {
      if (conversationActiveRef.current) void startListeningTurn("normal");
    });
  };

  const skipLessonQuestion = () => {
    if (!lesson || practiceStatus !== "in_progress" || isLoading) return;
    stopRecognition();
    void sendToCoach("", { skipQuestion: true });
  };

  const acceptPrivacyConsent = async () => {
    const settings: LearningSettings = {
      ...learningSettings,
      consentAcceptedAt: new Date().toISOString(),
      consentVersion: PRIVACY_CONSENT_VERSION,
    };
    const profile = {
      schemaVersion: LEARNING_SCHEMA_VERSION,
      id: "local-profile" as const,
      ...(learnerName.trim() ? { learnerName: learnerName.trim() } : {}),
      ...(englishGoal.trim() ? { englishGoal: englishGoal.trim() } : {}),
      updatedAt: new Date().toISOString(),
    };
    try {
      await learningRepositoryRef.current?.saveProfile(profile);
    } catch {
      setStorageAvailable(false);
    }
    saveLearningSettings(settings);
    setLearningSettings(settings);
  };

  useEffect(() => {
    if (
      isSpeechRecognitionSupported &&
      routeContextReady &&
      learningSessionReady &&
      (!lesson || hasCurrentPrivacyConsent(learningSettings))
    ) {
      startConversation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSpeechRecognitionSupported, learningSessionReady, learningSettings, routeContextReady]);

  useEffect(() => {
    return () => {
      conversationActiveRef.current = false;
      clearSilenceTimer();
      clearNoInputTimer();
      recognitionRef.current?.stop();
      if (learningSessionRef.current?.status === "in_progress") {
        const pausedSession = pausePracticeSession(learningSessionRef.current);
        learningSessionRef.current = pausedSession;
        void learningRepositoryRef.current?.saveSession(pausedSession);
      }
    };
  }, []);

  if (lesson && settingsReady && !hasCurrentPrivacyConsent(learningSettings)) {
    return (
      <section className={styles.consentLayout}>
        <div className={styles.consentPanel}>
          <span>Before your first lesson</span>
          <h2>How your speaking data is used</h2>
          <ul>
            <li>Microphone audio is used for speech recognition and is not stored by GabLab.</li>
            <li>Your transcript and recent conversation context are sent to the configured Cloudflare AI model.</li>
            <li>Lesson progress, reports, and transcripts are stored only in this browser.</li>
            <li>You can export or delete all local learning data from the dashboard.</li>
          </ul>
          <label>
            Preferred name <small>Optional</small>
            <input
              value={learnerName}
              onChange={(event) => setLearnerName(event.target.value)}
              maxLength={60}
              autoComplete="name"
            />
          </label>
          <label>
            English speaking goal <small>Optional</small>
            <input
              value={englishGoal}
              onChange={(event) => setEnglishGoal(event.target.value)}
              maxLength={160}
              placeholder="For example: speak more confidently at work"
            />
          </label>
          <div className={styles.consentActions}>
            <Button type="button" onClick={() => void acceptPrivacyConsent()}>I understand and continue</Button>
            <Button asChild variant="outline">
              <Link href="/">Back to dashboard</Link>
            </Button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={hasTextPanelContent ? styles.speakingLayout : styles.speakingLayoutSolo}>
      {lesson ? (
        <header className={styles.lessonContext}>
          <span>
            Week {lesson.week} · Lesson {lesson.sequence} · {lesson.level}
          </span>
          <strong>{lesson.title}</strong>
          <p>{lesson.summary}</p>
          <div className={styles.lessonControls} aria-label="Lesson controls">
            {practiceStatus === "in_progress" ? (
              <Button type="button" variant="outline" onClick={pauseLesson} disabled={isLoading}>
                <Pause aria-hidden="true" /> Pause
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={resumeLesson}
                disabled={
                  !learningSessionReady ||
                  !isSpeechRecognitionSupported ||
                  practiceStatus === "completed"
                }
              >
                <Play aria-hidden="true" /> Continue
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={replayAssistantReply}
              disabled={!coachReply || isLoading || practiceStatus !== "in_progress"}
            >
              <Volume2 aria-hidden="true" /> Replay AI
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={skipLessonQuestion}
              disabled={isLoading || practiceStatus !== "in_progress"}
            >
              <SkipForward aria-hidden="true" /> Skip question
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => endConversation()}
              disabled={
                !learningSessionReady ||
                (practiceStatus !== "in_progress" && practiceStatus !== "paused")
              }
            >
              <Square aria-hidden="true" /> End
            </Button>
          </div>
          {sessionNotice ? <p className={styles.sessionNotice} role="status">{sessionNotice}</p> : null}
          {!storageAvailable ? (
            <p className={styles.persistenceWarning} role="alert">
              Local storage is unavailable. This lesson will not persist after you leave the page.
            </p>
          ) : null}
        </header>
      ) : null}
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
          {!lesson ? (
            <LanguageSelector selectedLanguage={selectedLanguage} onLanguageChange={handleLanguageChange} />
          ) : null}
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

      {isReportLoading ? (
        <p className={styles.reportLoading} role="status">Generating your lesson report...</p>
      ) : null}

      {practiceReport ? (
        <section className={styles.reportPanel} aria-labelledby="lesson-report-title">
          <div className={styles.reportHeader}>
            <div>
              <span>{practiceReport.ratings ? "Standard lesson report" : "Practice summary"}</span>
              <h2 id="lesson-report-title">Your coaching report</h2>
            </div>
            {practiceReport.source === "fallback" ? <small>Limited summary</small> : null}
          </div>
          {practiceReport.ratings ? (
            <div className={styles.ratingGrid}>
              {practiceReport.ratings.map((rating) => (
                <article key={rating.dimension}>
                  <span>{rating.dimension}</span>
                  <strong>{rating.rating}/5</strong>
                  <p>{rating.evidence}</p>
                  <small>{rating.suggestion}</small>
                </article>
              ))}
            </div>
          ) : null}
          <div className={styles.reportColumns}>
            <div>
              <h3>Strengths</h3>
              <ul>{practiceReport.strengths.map((strength) => <li key={strength}>{strength}</li>)}</ul>
            </div>
            <div>
              <h3>Priority improvements</h3>
              {practiceReport.priorityErrors.length > 0 ? (
                <ul>
                  {practiceReport.priorityErrors.map((item) => (
                    <li key={item.id}><strong>{item.category}:</strong> {item.suggestion}</li>
                  ))}
                </ul>
              ) : <p>No priority correction was identified in this practice.</p>}
            </div>
          </div>
          <div className={styles.nextGoal}><strong>Next goal:</strong> {practiceReport.nextGoal}</div>
        </section>
      ) : null}
    </section>
  );
}
