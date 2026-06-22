import { requestCloudflare, requestOpenAI } from "../speaking/coach/providers.ts";
import type { CoachProviderEnv } from "../speaking/coach/providers.ts";
import type { OpenAIMessage } from "../speaking/coach/types.ts";
import type {
  CoachingSeverity,
  DimensionRating,
  LessonDefinition,
  PracticeReport,
  PracticeSession,
  SessionObservation,
  SkillDimension,
} from "./types.ts";

type FetchLike = typeof fetch;
type RawReport = {
  ratings?: Array<Partial<DimensionRating>> | null;
  strengths?: unknown;
  priorityErrors?: Array<Partial<SessionObservation>> | null;
  nextGoal?: unknown;
  selectedExpressions?: unknown;
};

const DIMENSIONS: SkillDimension[] = ["fluency", "accuracy", "vocabulary", "responsiveness"];
const SEVERITIES = new Set<CoachingSeverity>(["blocking", "recurring", "minor"]);

function normalizeText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeTextList(value: unknown, limit: number) {
  if (!Array.isArray(value)) return [];
  return value.map(normalizeText).filter((item): item is string => Boolean(item)).slice(0, limit);
}

function parseJsonObject(content: string): RawReport | null {
  const firstBrace = content.indexOf("{");
  const lastBrace = content.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace <= firstBrace) return null;
  try {
    return JSON.parse(content.slice(firstBrace, lastBrace + 1)) as RawReport;
  } catch {
    return null;
  }
}

function normalizeRatings(value: RawReport["ratings"]) {
  if (!Array.isArray(value)) return undefined;
  const ratings = DIMENSIONS.map((dimension) => {
    const candidate = value.find((rating) => rating.dimension === dimension);
    const rating = candidate?.rating;
    const evidence = normalizeText(candidate?.evidence);
    const suggestion = normalizeText(candidate?.suggestion);
    if (!Number.isInteger(rating) || Number(rating) < 1 || Number(rating) > 5 || !evidence || !suggestion) {
      return undefined;
    }
    return {
      dimension,
      rating: rating as 1 | 2 | 3 | 4 | 5,
      evidence,
      suggestion,
    };
  });
  return ratings.every(Boolean) ? ratings as DimensionRating[] : undefined;
}

function normalizePriorityErrors(value: RawReport["priorityErrors"], generatedAt: string) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate, index) => {
    const category = normalizeText(candidate.category);
    const evidence = normalizeText(candidate.evidence);
    const suggestion = normalizeText(candidate.suggestion);
    const severity = candidate.severity;
    if (!category || !evidence || !suggestion || !severity || !SEVERITIES.has(severity)) return [];
    return [{
      id: `report-error-${generatedAt}-${index}`,
      category,
      evidence,
      suggestion,
      severity,
    }];
  }).slice(0, 3);
}

export function createFallbackReport(
  session: PracticeSession,
  lesson: LessonDefinition,
  now = new Date(),
): PracticeReport {
  const generatedAt = now.toISOString();
  const correctedTurns = session.turns.filter(
    (turn) => turn.role === "user" && (turn.corrected || turn.feedback),
  );
  const priorityErrors = correctedTurns.slice(0, 3).map((turn, index): SessionObservation => ({
    id: `fallback-error-${generatedAt}-${index}`,
    turnId: turn.id,
    category: "language use",
    evidence: turn.content,
    suggestion: turn.feedback ?? (turn.corrected ? `Try saying: ${turn.corrected}` : "Review this expression."),
    severity: turn.severity ?? "minor",
  }));

  return {
    rubricVersion: session.rubricVersion,
    generatedAt,
    source: "fallback",
    strengths: [
      session.learnerTurnCount > 0
        ? `You completed ${session.learnerTurnCount} speaking turns in this practice.`
        : "You started this lesson and established a practice record.",
    ],
    priorityErrors,
    nextGoal: priorityErrors[0]?.suggestion ?? `Continue working toward: ${lesson.summary}`,
    selectedExpressions: [],
  };
}

function buildReportMessages(session: PracticeSession, lesson: LessonDefinition): OpenAIMessage[] {
  const completed = session.status === "completed";
  const transcript = session.turns.slice(-60).map((turn) => ({
    role: turn.role,
    content: turn.content.slice(0, 1200),
    corrected: turn.corrected,
    feedback: turn.feedback,
  }));
  return [
    {
      role: "system",
      content:
        'You are evaluating an A2-B1 English speaking lesson. Return one JSON object only with: {"ratings":[{"dimension":"fluency|accuracy|vocabulary|responsiveness","rating":1,"evidence":"specific transcript evidence","suggestion":"one practical improvement"}],"strengths":["up to two"],"priorityErrors":[{"category":"short label","evidence":"learner wording","suggestion":"Traditional Chinese or written Cantonese explanation","severity":"blocking|recurring|minor"}],"nextGoal":"one concrete goal","selectedExpressions":["up to five useful English phrases"]}. Never infer pronunciation from transcript. Every rating needs evidence. Use Traditional Chinese or written Cantonese for explanations. ' +
        (completed
          ? "The session is complete: return exactly four ratings, one for each dimension."
          : "The session is incomplete: return ratings as null and provide only a concise practice summary."),
    },
    {
      role: "user",
      content: JSON.stringify({
        lesson: { title: lesson.title, goal: lesson.summary },
        session: {
          status: session.status,
          activeDurationMs: session.activeDurationMs,
          learnerTurnCount: session.learnerTurnCount,
        },
        transcript,
      }),
    },
  ];
}

export function isReportSession(value: unknown): value is PracticeSession {
  if (!value || typeof value !== "object") return false;
  const session = value as Partial<PracticeSession>;
  return (
    typeof session.id === "string" &&
    typeof session.lessonId === "string" &&
    typeof session.lessonVersion === "string" &&
    typeof session.rubricVersion === "string" &&
    typeof session.activeDurationMs === "number" &&
    Number.isFinite(session.activeDurationMs) &&
    session.activeDurationMs >= 0 &&
    typeof session.learnerTurnCount === "number" &&
    Number.isInteger(session.learnerTurnCount) &&
    session.learnerTurnCount >= 0 &&
    (session.status === "completed" || session.status === "incomplete") &&
    Array.isArray(session.turns) &&
    session.turns.length <= 100 &&
    session.turns.every(
      (turn) =>
        turn &&
        (turn.role === "user" || turn.role === "assistant") &&
        typeof turn.content === "string" &&
        turn.content.length > 0 &&
        turn.content.length <= 4000,
    )
  );
}

export async function createLessonReport(
  session: PracticeSession,
  lesson: LessonDefinition,
  env: CoachProviderEnv = process.env,
  fetchFn: FetchLike = fetch,
  now = new Date(),
): Promise<PracticeReport> {
  const messages = buildReportMessages(session, lesson);
  const provider = (env.AI_PROVIDER ?? "openai").toLowerCase();
  const result = provider === "cloudflare"
    ? await requestCloudflare(messages, env, fetchFn)
    : await requestOpenAI(messages, env, fetchFn);
  if ("error" in result) return createFallbackReport(session, lesson, now);

  const parsed = parseJsonObject(result.content);
  if (!parsed) return createFallbackReport(session, lesson, now);
  const generatedAt = now.toISOString();
  const ratings = session.status === "completed" ? normalizeRatings(parsed.ratings) : undefined;
  if (session.status === "completed" && !ratings) return createFallbackReport(session, lesson, now);

  return {
    rubricVersion: session.rubricVersion,
    generatedAt,
    source: "model",
    ...(ratings ? { ratings } : {}),
    strengths: normalizeTextList(parsed.strengths, 2),
    priorityErrors: normalizePriorityErrors(parsed.priorityErrors, generatedAt),
    nextGoal: normalizeText(parsed.nextGoal) ?? `Continue working toward: ${lesson.summary}`,
    selectedExpressions: normalizeTextList(parsed.selectedExpressions, 5),
  };
}

