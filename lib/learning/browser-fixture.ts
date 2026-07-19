import { INTRODUCING_YOURSELF_LESSON } from "./courses.ts";
import { normalizeReviewExpression } from "./review.ts";
import {
  appendSessionTurn,
  createPracticeSession,
  endPracticeSession,
} from "./session.ts";
import type { PracticeReport, PracticeSession, VocabularyReviewItem } from "./types.ts";

export const CONTROLLED_FIXTURE_SESSION_ID = "controlled-browser-fixture";

export const CONTROLLED_TRANSCRIPTS = [
  "I am from Hong Kong and I work in product design.",
  "I usually start my day with coffee and check my messages.",
  "First I plan my tasks, then I work on the most important one.",
  "I often have lunch with my colleagues near the office.",
  "In the afternoon I join meetings and explain my ideas.",
  "One thing I enjoy is solving a difficult design problem.",
  "Last week I presented a new idea to my team.",
  "I was nervous at first, but the discussion went well.",
  "After work I sometimes go for a walk with my family.",
  "Most of the time I practise English by listening to podcasts.",
  "I want to speak more confidently during international meetings.",
  "My next goal is to explain one idea clearly without translating first.",
] as const;

export const CONTROLLED_SELECTED_EXPRESSIONS = [
  "Most of the time",
  "I was nervous at first",
  "My next goal is to",
] as const;

type FixtureRepository = {
  saveSession: (session: PracticeSession) => Promise<void>;
  getSession: (sessionId: string) => Promise<PracticeSession | undefined>;
  deleteSession: (sessionId: string) => Promise<void>;
  enqueueVocabularyReviewExpressions: (input: {
    expressions: string[];
    lessonId: string;
    sessionId: string;
    now?: Date;
  }) => Promise<unknown>;
  listVocabularyReviewItems: () => Promise<VocabularyReviewItem[]>;
  deleteVocabularyReviewItemsBySourceSession: (sessionId: string) => Promise<number>;
};

export type ControlledFixtureResult = {
  sessionId: string;
  status: PracticeSession["status"];
  learnerTurnCount: number;
  checkpointSaveCount: number;
  reportRatingCount: number;
  reviewExpressionCount: number;
  cleanupComplete: boolean;
};

function createControlledReport(now: Date): PracticeReport {
  return {
    rubricVersion: "speaking-rubric-v1",
    generatedAt: now.toISOString(),
    source: "model",
    ratings: [
      {
        dimension: "fluency",
        rating: 3,
        evidence: "The learner sustained twelve relevant answers with sequencing language.",
        suggestion: "Connect two details before pausing.",
      },
      {
        dimension: "accuracy",
        rating: 4,
        evidence: "The learner used present and past forms consistently in the fixture transcript.",
        suggestion: "Keep checking articles in longer answers.",
      },
      {
        dimension: "vocabulary",
        rating: 3,
        evidence: "The learner used routine, work, and goal-setting expressions.",
        suggestion: "Add one more precise verb when explaining work tasks.",
      },
      {
        dimension: "responsiveness",
        rating: 4,
        evidence: "Every controlled prompt received a direct and relevant response.",
        suggestion: "Add a concrete example to one follow-up answer.",
      },
    ],
    strengths: ["Clear sequencing", "Relevant workplace examples"],
    priorityErrors: [],
    nextGoal: "Explain one workplace idea with a reason and an example.",
    selectedExpressions: [...CONTROLLED_SELECTED_EXPRESSIONS],
  };
}

export async function runControlledLessonFixture(
  repository: FixtureRepository,
  now = new Date(),
): Promise<ControlledFixtureResult> {
  const lesson = INTRODUCING_YOURSELF_LESSON;
  const startedAt = new Date(now.getTime() - lesson.standard.minimumActiveMinutes * 60_000);
  let session = createPracticeSession({
    id: CONTROLLED_FIXTURE_SESSION_ID,
    lesson,
    mode: "standard",
    modelId: "controlled-browser-fixture",
    now: startedAt,
  });
  let checkpointSaveCount = 0;
  await repository.saveSession(session);
  checkpointSaveCount += 1;

  for (let index = 0; index < CONTROLLED_TRANSCRIPTS.length; index += 1) {
    const turnTime = new Date(startedAt.getTime() + (index + 1) * 60_000);
    const responseDurationMs = 4_000 + index * 120;
    session = appendSessionTurn(session, {
      id: `fixture-user-${index + 1}`,
      role: "user",
      content: CONTROLLED_TRANSCRIPTS[index],
      createdAt: turnTime.toISOString(),
      speechMetrics: {
        responseDurationMs,
        speakingDurationMs: responseDurationMs - 700,
        leadInDurationMs: 300,
        pauseCount: 1,
        totalPauseDurationMs: 700,
      },
    }, turnTime);
    session = appendSessionTurn(session, {
      id: `fixture-assistant-${index + 1}`,
      role: "assistant",
      content: `Controlled follow-up question ${index + 1}.`,
      createdAt: new Date(turnTime.getTime() + 5_000).toISOString(),
    }, turnTime);
    await repository.saveSession(session);
    checkpointSaveCount += 1;
  }

  const endedSession = endPracticeSession(session, lesson, now);
  await repository.saveSession(endedSession);
  checkpointSaveCount += 1;

  const report = createControlledReport(now);
  const sessionWithReport = { ...endedSession, report };
  await repository.saveSession(sessionWithReport);
  checkpointSaveCount += 1;
  await repository.enqueueVocabularyReviewExpressions({
    expressions: report.selectedExpressions,
    lessonId: lesson.id,
    sessionId: sessionWithReport.id,
    now,
  });

  const [persistedSession, reviewItems] = await Promise.all([
    repository.getSession(sessionWithReport.id),
    repository.listVocabularyReviewItems(),
  ]);
  const expectedExpressionKeys = new Set(report.selectedExpressions.map(normalizeReviewExpression));
  const reviewExpressionCount = reviewItems.filter((item) =>
    expectedExpressionKeys.has(item.expressionKey),
  ).length;

  if (!persistedSession?.report || persistedSession.status !== "completed") {
    throw new Error("Controlled fixture session did not persist as completed with a report.");
  }
  if (reviewExpressionCount !== report.selectedExpressions.length) {
    throw new Error("Controlled fixture expressions were not persisted to vocabulary review.");
  }

  await Promise.all([
    repository.deleteSession(sessionWithReport.id),
    repository.deleteVocabularyReviewItemsBySourceSession(sessionWithReport.id),
  ]);
  const [removedSession, remainingReviewItems] = await Promise.all([
    repository.getSession(sessionWithReport.id),
    repository.listVocabularyReviewItems(),
  ]);
  const fixtureReviewsRemain = remainingReviewItems.some(
    (item) => item.sourceSessionId === sessionWithReport.id,
  );
  if (removedSession || fixtureReviewsRemain) {
    throw new Error("Controlled fixture data cleanup failed.");
  }

  return {
    sessionId: persistedSession.id,
    status: persistedSession.status,
    learnerTurnCount: persistedSession.learnerTurnCount,
    checkpointSaveCount,
    reportRatingCount: persistedSession.report.ratings?.length ?? 0,
    reviewExpressionCount,
    cleanupComplete: true,
  };
}
