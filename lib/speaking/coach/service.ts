import { buildCoachMessages } from "./messages.ts";
import { requestCloudflare, requestOpenAI } from "./providers.ts";
import { extractCoachReply, normalizeFeedback } from "./response-parser.ts";
import type { CoachFailure, CoachPayload, CoachSuccess } from "./types.ts";
import type { CoachProviderEnv } from "./providers.ts";

type FetchLike = typeof fetch;

export async function createCoachResponse(
  payload: CoachPayload,
  env: CoachProviderEnv = process.env,
  fetchFn: FetchLike = fetch,
): Promise<CoachSuccess | CoachFailure> {
  const utterance = payload.utterance?.trim() ?? "";
  if (!utterance) {
    return { error: "Missing utterance.", status: 400 };
  }

  const messages = buildCoachMessages(utterance, payload.history);
  const provider = (env.AI_PROVIDER ?? "openai").toLowerCase();
  const modelResponse =
    provider === "cloudflare"
      ? await requestCloudflare(messages, env, fetchFn)
      : await requestOpenAI(messages, env, fetchFn);

  if ("error" in modelResponse) {
    return modelResponse;
  }

  return {
    corrected: utterance,
    feedback: normalizeFeedback(undefined),
    coachReply: extractCoachReply(modelResponse.content) || "Nice try. Can you tell me more?",
  };
}
