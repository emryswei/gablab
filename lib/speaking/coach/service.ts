import { buildCoachMessages } from "./messages.ts";
import { requestCloudflare, requestOpenAI } from "./providers.ts";
import { extractCoachReply, normalizeFeedback, normalizeOptionalText, parseCoachContent } from "./response-parser.ts";
import { getLessonById } from "../../learning/courses.ts";
import type { CoachFailure, CoachPayload, CoachSuccess } from "./types.ts";
import type { CoachProviderEnv } from "./providers.ts";

type FetchLike = typeof fetch;

export async function createCoachResponse(
  payload: CoachPayload,
  env: CoachProviderEnv = process.env,
  fetchFn: FetchLike = fetch,
): Promise<CoachSuccess | CoachFailure> {
  const learnerUtterance = payload.utterance?.trim() ?? "";
  if (!learnerUtterance && !payload.skipQuestion) {
    return { error: "Missing utterance.", status: 400 };
  }

  const language = payload.language === "cantonese" ? "cantonese" : "english";
  const lesson = language === "english" && payload.lessonId ? getLessonById(payload.lessonId) : undefined;
  const utterance = payload.skipQuestion
    ? "The learner chose to skip this question. Ask a different short question from another unfinished lesson checkpoint."
    : learnerUtterance;
  const messages = buildCoachMessages(utterance, payload.history, language, lesson);
  const provider = (env.AI_PROVIDER ?? "openai").toLowerCase();
  const modelResponse =
    provider === "cloudflare"
      ? await requestCloudflare(messages, env, fetchFn)
      : await requestOpenAI(messages, env, fetchFn);

  if ("error" in modelResponse) {
    return modelResponse;
  }

  const parsed = parseCoachContent(modelResponse.content);
  const reply =
    extractCoachReply(modelResponse.content) ||
    (language === "cantonese" ? "講得幾好，你可以再講多少少。" : "Nice try. Tell me more.");
  const corrected = payload.skipQuestion ? undefined : normalizeOptionalText(parsed?.corrected);
  const feedback = payload.skipQuestion ? undefined : normalizeFeedback(parsed?.feedback);
  const followUpQuestion = normalizeOptionalText(parsed?.followUpQuestion);
  const coachReply = followUpQuestion && !reply.includes(followUpQuestion) ? `${reply} ${followUpQuestion}` : reply;

  return {
    reply,
    ...(corrected && corrected !== learnerUtterance ? { corrected } : {}),
    ...(feedback ? { feedback } : {}),
    ...(followUpQuestion ? { followUpQuestion } : {}),
    coachReply,
  };
}
