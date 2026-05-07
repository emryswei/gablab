export type ChatTurn = {
  role: "user" | "assistant";
  content: string;
};

export type CoachPayload = {
  utterance?: string;
  history?: ChatTurn[];
};

export type OpenAIMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type CompletionResponse = {
  choices?: Array<{ message?: { content?: string } }>;
};

export type ParsedCoach = {
  corrected?: string;
  feedback?: string | string[];
  coachReply?: string;
};

export type CoachSuccess = {
  corrected: string;
  feedback: string;
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

