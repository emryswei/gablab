"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./speaking-coach.module.css";

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
  const visualizerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const visualizerRafRef = useRef<number | null>(null);
  const aiSpeakingStartedAtRef = useRef(0);
  const aiSpeakingSeedRef = useRef(1);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
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
  const isAssistantSpeakingRef = useRef(false);

  const [isSupported, setIsSupported] = useState(false);
  const [isConversationActive, setIsConversationActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAssistantSpeaking, setIsAssistantSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [coachReply, setCoachReply] = useState<string | null>(null);
  const [history, setHistory] = useState<ChatTurn[]>([]);
  const [error, setError] = useState<string | null>(null);

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
    isAssistantSpeakingRef.current = isAssistantSpeaking;
  }, [isAssistantSpeaking]);

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

  const hashText = (text: string) => {
    let hash = 0;
    for (let i = 0; i < text.length; i += 1) {
      hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
    }
    return (hash % 997) + 1;
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

  const speakOutLoud = (text: string, onDone?: () => void) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      onDone?.();
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 1;
    utterance.onend = () => {
      setIsAssistantSpeaking(false);
      onDone?.();
    };
    utterance.onerror = () => {
      setIsAssistantSpeaking(false);
      onDone?.();
    };
    setIsAssistantSpeaking(true);
    aiSpeakingStartedAtRef.current = performance.now();
    aiSpeakingSeedRef.current = hashText(text);
    window.speechSynthesis.speak(utterance);
  };

  const ensureMicVisualizer = async () => {
    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      return;
    }

    if (analyserRef.current && audioContextRef.current) {
      if (audioContextRef.current.state === "suspended") {
        await audioContextRef.current.resume();
      }
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const audioContext = new window.AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.82;
      source.connect(analyser);

      micStreamRef.current = stream;
      audioContextRef.current = audioContext;
      micSourceRef.current = source;
      analyserRef.current = analyser;
    } catch {
      setError("Microphone access is required for real-time wave visualization.");
    }
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
    recognition.lang = "en-US";
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
    setIsConversationActive(true);
    conversationActiveRef.current = true;
    stopRecognition();

    speakOutLoud(GREETING, () => {
      if (conversationActiveRef.current) {
        void startListeningTurn("normal");
      }
    });
  };

  const endConversation = (message?: string) => {
    setIsConversationActive(false);
    conversationActiveRef.current = false;
    stopRecognition();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsAssistantSpeaking(false);
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
    const canvas = visualizerCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const bars = 78;
    const barGap = 3;
    const barWidth = Math.max(1, (width - (bars - 1) * barGap) / bars);
    const freqData = new Uint8Array(2048);

    const render = () => {
      const analyser = analyserRef.current;
      const listening = isListeningRef.current;
      const assistantSpeaking = isAssistantSpeakingRef.current;

      if (analyser && listening) {
        analyser.getByteFrequencyData(freqData);
      } else {
        const elapsed = Math.max(0, performance.now() - aiSpeakingStartedAtRef.current);
        const seed = aiSpeakingSeedRef.current;
        const sampleRate = audioContextRef.current?.sampleRate ?? 48000;
        const nyquist = sampleRate / 2;

        const phraseEnvelope = 0.45 + 0.55 * Math.max(0, Math.sin(elapsed * 0.004 + seed * 0.001));
        const syllableEnvelope = 0.35 + 0.65 * Math.max(0, Math.sin(elapsed * 0.013 + seed * 0.017));
        const baseF0 =
          120 +
          35 * Math.sin(elapsed * 0.0026 + seed * 0.003) +
          18 * Math.sin(elapsed * 0.0051 + seed * 0.009);

        const formant1 = 420 + 140 * Math.sin(elapsed * 0.0019 + seed * 0.004);
        const formant2 = 1500 + 320 * Math.sin(elapsed * 0.0013 + seed * 0.007);
        const formant3 = 2550 + 260 * Math.sin(elapsed * 0.001 + seed * 0.011);

        for (let i = 0; i < freqData.length; i += 1) {
          const freqHz = (i / (freqData.length - 1)) * nyquist;
          if (assistantSpeaking) {
            let harmonicEnergy = 0;
            for (let h = 1; h <= 7; h += 1) {
              const harmonicFreq = baseF0 * h;
              if (harmonicFreq > nyquist) break;
              const spread = 20 + h * 8;
              const distance = Math.abs(freqHz - harmonicFreq);
              harmonicEnergy += Math.exp(-Math.pow(distance / spread, 2)) * (1 / h);
            }

            const vowelShape =
              0.9 * Math.exp(-Math.pow((freqHz - formant1) / 170, 2)) +
              0.75 * Math.exp(-Math.pow((freqHz - formant2) / 230, 2)) +
              0.55 * Math.exp(-Math.pow((freqHz - formant3) / 320, 2));

            const fricativeNoise = 0.06 * Math.exp(-Math.pow((freqHz - 4200) / 1300, 2));
            const energy = Math.min(1, (harmonicEnergy * (0.72 + vowelShape) + fricativeNoise) * phraseEnvelope * syllableEnvelope);
            const emphasized = Math.min(1, Math.pow(energy, 0.66) * 1.32);
            freqData[i] = Math.floor(emphasized * 255);
          } else {
            freqData[i] = 0;
          }
        }
      }

      ctx.clearRect(0, 0, width, height);

      // Frequency bars: fillRect()
      for (let i = 0; i < bars; i += 1) {
        const bin = Math.floor((i / bars) * Math.min(freqData.length, 1024));
        const v = (freqData[bin] ?? 0) / 255;
        const visualV = assistantSpeaking ? Math.min(1, Math.pow(v, 0.72) * 1.2) : v;
        const h = Math.max(assistantSpeaking ? 8 : 2, visualV * (height - 10));
        const x = i * (barWidth + barGap);
        const y = height - h - 2;
        const hue = 210 - visualV * 75;
        const light = 35 + visualV * 44;
        ctx.fillStyle = `hsl(${hue}, 95%, ${light}%)`;
        ctx.fillRect(x, y, barWidth, h);

        if (assistantSpeaking) {
          ctx.fillStyle = `hsla(${hue - 8}, 98%, 86%, 0.42)`;
          ctx.fillRect(x, y, barWidth, 2);
        }
      }

      visualizerRafRef.current = window.requestAnimationFrame(render);
    };

    visualizerRafRef.current = window.requestAnimationFrame(render);
    return () => {
      if (visualizerRafRef.current !== null) {
        window.cancelAnimationFrame(visualizerRafRef.current);
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      conversationActiveRef.current = false;
      clearSilenceTimer();
      clearNoInputTimer();
      if (visualizerRafRef.current !== null) {
        window.cancelAnimationFrame(visualizerRafRef.current);
      }
      recognitionRef.current?.stop();
      micSourceRef.current?.disconnect();
      if (audioContextRef.current) {
        void audioContextRef.current.close();
      }
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  return (
    <section
      style={{
        padding: 16,
      }}
    >
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

      <p style={{ marginTop: 12, color: "#4b5563" }}>
        Status:{" "}
        {isAssistantSpeaking
          ? "Assistant speaking"
          : isLoading
            ? "Thinking"
            : isListening
              ? "Listening"
              : isConversationActive
                ? "Waiting"
                : "Conversation ended"}
      </p>

      <div className={styles.spectrogramFrame} aria-hidden="true">
        <canvas ref={visualizerCanvasRef} className={styles.spectrogramCanvas} width={620} height={140} />
      </div>

      {coachReply ? (
        <div
          style={{
            marginTop: 14,
            border: "1px solid #d1d5db",
            borderRadius: 10,
            padding: 12,
            background: "#fff",
          }}
        >
          <p style={{ marginTop: 8 }}>
            <strong>AI reply:</strong> {coachReply}
          </p>
        </div>
      ) : null}

      <div
        style={{
          marginTop: 14,
          border: "1px solid #e5e7eb",
          borderRadius: 10,
          padding: 12,
          minHeight: 90,
          background: "#fff",
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 700, color: "#6b7280" }}>You said</div>
        <p style={{ marginTop: 6, fontSize: 18 }}>{`${transcript} ${interim}`.trim() || "..."}</p>
      </div>

      {error ? <p style={{ marginTop: 12, color: "#b42318" }}>{error}</p> : null}
    </section>
  );
}
