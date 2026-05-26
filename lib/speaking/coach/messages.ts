import type { ChatTurn, OpenAIMessage } from "./types.ts";
import type { SpeakingLanguage } from "../browser-voices.ts";

const COACH_SYSTEM_PROMPTS: Record<SpeakingLanguage, string> = {
  english:
    "You are an English-speaking coach. Return only one short conversational reply in plain text with one follow-up question. Do not return JSON. Do not include labels like corrected, feedback, or coachReply. Keep CEFR A2-B2 friendly.",
  cantonese:
    "You are a Cantonese speaking coach. Reply in natural written Traditional Cantonese that sounds like Hong Kong spoken Cantonese. Return only one short conversational reply in plain text with one follow-up question. Do not return JSON. Do not include labels like corrected, feedback, or coachReply. Do not switch to Mandarin or English unless the learner does first.",
};

export function getCoachSystemPrompt(language: SpeakingLanguage) {
  return COACH_SYSTEM_PROMPTS[language];
}

export function isChatTurn(value: unknown): value is ChatTurn {
  if (!value || typeof value !== "object") return false;
  const turn = value as Partial<ChatTurn>;
  return (
    (turn.role === "user" || turn.role === "assistant") &&
    typeof turn.content === "string" &&
    turn.content.trim().length > 0
  );
}

export function getRecentHistory(history: unknown, limit = 8): ChatTurn[] {
  if (!Array.isArray(history)) return [];
  return history.filter(isChatTurn).slice(-limit);
}

export function buildCoachMessages(
  utterance: string,
  history: unknown,
  language: SpeakingLanguage = "english",
): OpenAIMessage[] {
  return [
    {
      role: "system",
      content: getCoachSystemPrompt(language),
    },
    ...getRecentHistory(history).map((turn) => ({
      role: turn.role,
      content: turn.content.trim(),
    })),
    {
      role: "user",
      content: utterance,
    },
  ];
}
