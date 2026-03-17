"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

type CoachResponse = {
  corrected: string;
  feedback: string;
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

type SpeechRecognitionLike = EventTarget & {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type WindowWithSpeechRecognition = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

export default function SpeakingCoach() {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [coach, setCoach] = useState<CoachResponse | null>(null);
  const [history, setHistory] = useState<ChatTurn[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    const speechWindow = window as WindowWithSpeechRecognition;
    setIsSupported(Boolean(speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition));
  }, []);

  const stopListening = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
  };

  const speakOutLoud = (text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 1;
    window.speechSynthesis.speak(utterance);
  };

  const sendToCoach = async (utterance: string) => {
    if (!utterance.trim()) return;
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/speaking/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          utterance,
          history: history.slice(-8),
        }),
      });

      const payload = (await response.json()) as CoachResponse & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to get AI coach response.");
      }

      const parsed: CoachResponse = {
        corrected: payload.corrected ?? "",
        feedback: payload.feedback ?? "",
        coachReply: payload.coachReply ?? "",
      };

      setCoach(parsed);
      setHistory((prev) => [
        ...prev,
        { role: "user", content: utterance },
        { role: "assistant", content: parsed.coachReply },
      ]);
      speakOutLoud(parsed.coachReply);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get AI coach response.");
    } finally {
      setIsLoading(false);
    }
  };

  const startListening = () => {
    if (!isSupported || typeof window === "undefined") return;
    setError(null);

    const speechWindow = window as WindowWithSpeechRecognition;
    const SpeechRecognitionCtor = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return;

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      let finalText = "";
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) {
          finalText += result[0].transcript;
        } else {
          interimText += result[0].transcript;
        }
      }

      if (finalText) {
        setTranscript((prev) => `${prev} ${finalText}`.trim());
      }
      setInterim(interimText);
    };

    recognition.onerror = () => {
      setIsListening(false);
      setError("Speech recognition failed. Check microphone permission and try again.");
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
    recognitionRef.current = recognition;
    setIsListening(true);
  };

  return (
    <section
      style={{
        border: "1px solid #d1d5db",
        borderRadius: 14,
        padding: 16,
        background: "#f9fafb",
      }}
    >
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Button type="button" onClick={startListening} disabled={!isSupported || isListening || isLoading}>
          Start Speaking
        </Button>
        <Button type="button" variant="outline" onClick={stopListening} disabled={!isListening}>
          Stop
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => sendToCoach(`${transcript} ${interim}`.trim())}
          disabled={isLoading || (!transcript.trim() && !interim.trim())}
        >
          Get AI Response
        </Button>
      </div>

      {!isSupported ? (
        <p style={{ marginTop: 12, color: "#b42318" }}>
          Your browser does not support SpeechRecognition. Use Chrome/Edge for voice input.
        </p>
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

      {isLoading ? <p style={{ marginTop: 12 }}>AI is thinking...</p> : null}
      {error ? <p style={{ marginTop: 12, color: "#b42318" }}>{error}</p> : null}

      {coach ? (
        <div
          style={{
            marginTop: 16,
            border: "1px solid #d1d5db",
            borderRadius: 10,
            padding: 12,
            background: "#fff",
          }}
        >
          <p>
            <strong>Corrected sentence:</strong> {coach.corrected}
          </p>
          <p style={{ marginTop: 8 }}>
            <strong>Feedback:</strong> {coach.feedback}
          </p>
          <p style={{ marginTop: 8 }}>
            <strong>AI reply:</strong> {coach.coachReply}
          </p>
        </div>
      ) : null}
    </section>
  );
}
