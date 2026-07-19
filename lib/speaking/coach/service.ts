import { buildCoachMessages } from "./messages.ts";
import { requestCloudflare, requestOpenAI } from "./providers.ts";
import { extractCoachReply, normalizeFeedback, normalizeOptionalText, parseCoachContent } from "./response-parser.ts";
import { getLessonById } from "../../learning/courses.ts";
import type { CoachFailure, CoachPayload, CoachSuccess } from "./types.ts";
import type { CoachProviderEnv } from "./providers.ts";

type FetchLike = typeof fetch;

function hasClearCantoneseIssue(utterance: string) {
  return /[A-Za-z]|昨天|吃|不|的|然後|去了|買了|了一|一咖啡/.test(utterance);
}

function hasLatinLetter(value: string) {
  return /[A-Za-z]/.test(value);
}

function hasKnownBadCantoneseAdvice(utterance: string, value: string) {
  return (
    (utterance.includes("尋日") && value.includes("前日")) ||
    (utterance.includes("有少少") && value.includes("有點")) ||
    (utterance.includes("屋企人") && value.includes("家人"))
  );
}

function createCantoneseFallbackCorrection(utterance: string) {
  if (/[A-Za-z]/.test(utterance)) {
    return {
      corrected: utterance
        .replace(/一個\s*meeting/gi, "個會")
        .replace(/meeting/gi, "會")
        .replace(/一個/g, "個"),
      feedback: "英文夾雜可以改成更自然嘅廣東話，例如將 meeting 講成「會」。",
    };
  }

  if (utterance.includes("不")) {
    return {
      corrected: utterance.replaceAll("不", "唔"),
      feedback: "口語廣東話一般用「唔」，少用「不」。",
    };
  }

  if (utterance.includes("昨天") || utterance.includes("去了") || utterance.includes("吃")) {
    return {
      corrected: utterance
        .replaceAll("昨天", "尋日")
        .replaceAll("去了", "去咗")
        .replaceAll("吃", "食"),
      feedback: "「尋日」、「去咗」同「食」會更加似香港口語廣東話。",
    };
  }

  if (utterance.includes("然後")) {
    return {
      corrected: utterance.replaceAll("然後", "之後"),
      feedback: "日常廣東話可以用「之後」代替較書面嘅「然後」。",
    };
  }

  if (utterance.includes("一咖啡")) {
    return {
      corrected: utterance.replaceAll("一咖啡", "杯咖啡"),
      feedback: "咖啡要配量詞，通常講「杯咖啡」。",
    };
  }

  return undefined;
}

function createCantoneseFallbackQuestion(skipQuestion?: boolean) {
  return skipQuestion ? "你放假通常會做啲咩？" : "你可以講多少少嗎？";
}

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
    ? language === "cantonese"
      ? "The learner chose to skip this question. 用自然香港廣東話問另一條簡短問題，唔好提供 corrected 或 feedback。"
      : "The learner chose to skip this question. Ask a different short question from another unfinished lesson checkpoint."
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
  const parsedReply =
    extractCoachReply(modelResponse.content) ||
    (language === "cantonese" ? "講得幾好，你可以再講多少少。" : "Nice try. Tell me more.");
  const reply =
    language === "cantonese" && hasLatinLetter(parsedReply)
      ? "明白。"
      : parsedReply;
  const parsedCorrection = payload.skipQuestion ? undefined : normalizeOptionalText(parsed?.corrected);
  const parsedFeedback = payload.skipQuestion ? undefined : normalizeFeedback(parsed?.feedback);
  const fallbackCorrection =
    language === "cantonese" && !payload.skipQuestion
      ? createCantoneseFallbackCorrection(learnerUtterance)
      : undefined;
  const modelAdvice = `${parsedCorrection ?? ""} ${parsedFeedback ?? ""}`;
  const shouldRejectModelCorrection =
    language === "cantonese" &&
    Boolean(parsedCorrection) &&
    (hasKnownBadCantoneseAdvice(learnerUtterance, modelAdvice) ||
      (Boolean(fallbackCorrection) && parsedCorrection === learnerUtterance));
  const shouldSuppressCorrection =
    language === "cantonese" &&
    Boolean(parsedCorrection) &&
    !fallbackCorrection &&
    !hasClearCantoneseIssue(learnerUtterance);
  const corrected =
    shouldSuppressCorrection
      ? undefined
      : shouldRejectModelCorrection
        ? fallbackCorrection?.corrected
        : parsedCorrection ?? fallbackCorrection?.corrected;
  const feedback =
    payload.skipQuestion || shouldSuppressCorrection
      ? undefined
      : shouldRejectModelCorrection
        ? fallbackCorrection?.feedback
        : parsedFeedback ?? (corrected ? fallbackCorrection?.feedback : undefined);
  const parsedFollowUpQuestion = normalizeOptionalText(parsed?.followUpQuestion);
  const followUpQuestion =
    language === "cantonese" && (!parsedFollowUpQuestion || hasLatinLetter(parsedFollowUpQuestion))
      ? createCantoneseFallbackQuestion(payload.skipQuestion)
      : parsedFollowUpQuestion;
  const coachReply = followUpQuestion && !reply.includes(followUpQuestion) ? `${reply} ${followUpQuestion}` : reply;

  return {
    reply,
    ...(corrected && corrected !== learnerUtterance ? { corrected } : {}),
    ...(feedback ? { feedback } : {}),
    ...(followUpQuestion ? { followUpQuestion } : {}),
    coachReply,
  };
}
