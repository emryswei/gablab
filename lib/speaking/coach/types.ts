import type { SpeakingLanguage } from "../browser-voices.ts";

export type ChatTurn = {
  role: "user" | "assistant";
  content: string;
};

export type CoachPayload = {
  utterance?: string;
  history?: ChatTurn[];
  language?: SpeakingLanguage;
  lessonId?: string;
  skipQuestion?: boolean;
};

export type OpenAIMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type CompletionResponse = {
  choices?: Array<{ message?: { content?: string } }>;
};

export type ParsedCoach = {
  reply?: string;
  corrected?: string | null;
  feedback?: string | string[] | null;
  followUpQuestion?: string | null;
  coachReply?: string;
};

export type CoachSuccess = {
  reply: string;
  corrected?: string;
  feedback?: string;
  followUpQuestion?: string;
  /** Compatibility field for clients that speak or render one combined response. */
  coachReply: string;
};

export type CoachFailure = {
  error: string;
  status: 400 | 500 | 502;
};

export type ModelSuccess = {
  content: string;
};

export type ModelFailure = {
  error: string;
  status: 500 | 502;
};

export type ModelResult = ModelSuccess | ModelFailure;
