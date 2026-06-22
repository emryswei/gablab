import type { ChatTurn, OpenAIMessage } from "./types.ts";
import type { SpeakingLanguage } from "../browser-voices.ts";
import type { LessonDefinition } from "../../learning/types.ts";

const COACH_SYSTEM_PROMPTS: Record<SpeakingLanguage, string> = {
  english:
    'You are an English-speaking coach. Respond with one JSON object only using this schema: {"reply":"short natural reaction","corrected":"improved learner sentence or null","feedback":"one practical coaching note or null","followUpQuestion":"one short question"}. Keep CEFR A2-B2 friendly. Only provide corrected and feedback when they are helpful; do not over-correct natural speech. Keep reply separate from followUpQuestion.',
  cantonese:
    'You are a Cantonese speaking coach. Respond with one JSON object only using this schema: {"reply":"short natural reaction","corrected":"improved learner sentence or null","feedback":"one practical coaching note or null","followUpQuestion":"one short question"}. Write in natural Traditional Cantonese that sounds like Hong Kong spoken Cantonese. Only provide corrected and feedback when helpful; do not switch to Mandarin or English unless the learner does first. Keep reply separate from followUpQuestion.',
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
  lesson?: LessonDefinition,
): OpenAIMessage[] {
  const lessonContext = lesson
    ? `\n\nCurrent lesson: ${lesson.title}. Learning goal: ${lesson.summary} Checkpoints: ${lesson.checkpoints
        .map((checkpoint) => `${checkpoint.title} (${checkpoint.promptGoal})`)
        .join("; ")}. Ask adaptive follow-up questions that move through these checkpoints naturally.`
    : "";
  return [
    {
      role: "system",
      content: `${getCoachSystemPrompt(language)}${lessonContext}`,
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
