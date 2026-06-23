import type { SpeakingBaseline } from "./types.ts";

export const BASELINE_PROMPTS = [
  {
    id: "introduction",
    title: "Introduce yourself",
    prompt: "Tell me where you are from, what you do, and one thing you enjoy.",
  },
  {
    id: "routine",
    title: "Describe your routine",
    prompt: "Describe a typical weekday from morning to evening.",
  },
  {
    id: "experience",
    title: "Share an experience",
    prompt: "Talk about something interesting that happened recently and what happened next.",
  },
  {
    id: "goal",
    title: "Explain your goal",
    prompt: "Explain one situation where you want to speak English more confidently and why.",
  },
] as const;

const WORD_PATTERN = /[A-Za-z]+(?:'[A-Za-z]+)?/g;
const SEQUENCE_PATTERN = /\b(first|then|next|after|before|finally|morning|afternoon|evening)\b/i;
const REASON_PATTERN = /\b(because|so|since|reason|why|therefore)\b/i;

export function countBaselineWords(response: string) {
  return response.match(WORD_PATTERN)?.length ?? 0;
}

export function createSpeakingBaseline({
  responses,
  startedAt,
  recommendedLessonId,
  now = new Date(),
}: {
  responses: string[];
  startedAt: Date;
  recommendedLessonId: string;
  now?: Date;
}): SpeakingBaseline {
  const completedResponses = responses.map((response) => response.trim()).filter(Boolean);
  if (completedResponses.length !== BASELINE_PROMPTS.length) {
    throw new Error(`Complete all ${BASELINE_PROMPTS.length} baseline prompts.`);
  }

  const totalWordCount = completedResponses.reduce(
    (total, response) => total + countBaselineWords(response),
    0,
  );
  const averageWordsPerResponse = Math.round(totalWordCount / completedResponses.length);
  const combinedResponses = completedResponses.join(" ");
  const focusAreas: string[] = [];

  if (averageWordsPerResponse < 18) {
    focusAreas.push("Build longer answers with one extra detail or example.");
  }
  if (!SEQUENCE_PATTERN.test(combinedResponses)) {
    focusAreas.push("Use sequencing words such as first, then, and finally.");
  }
  if (!REASON_PATTERN.test(combinedResponses)) {
    focusAreas.push("Support an answer with because and one clear reason.");
  }
  if (focusAreas.length === 0) {
    focusAreas.push("Keep extending answers with specific examples and follow-up details.");
  }

  return {
    version: "speaking-baseline-v1",
    completedAt: now.toISOString(),
    durationMs: Math.max(0, now.getTime() - startedAt.getTime()),
    responseCount: completedResponses.length,
    totalWordCount,
    averageWordsPerResponse,
    focusAreas: focusAreas.slice(0, 2),
    recommendedLessonId,
  };
}
