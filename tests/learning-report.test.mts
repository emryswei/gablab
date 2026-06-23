import test from "node:test";
import assert from "node:assert/strict";

import { INTRODUCING_YOURSELF_LESSON } from "../lib/learning/courses.ts";
import { createFallbackReport, createLessonReport, isReportSession } from "../lib/learning/report.ts";
import { appendSessionTurn, createPracticeSession, endPracticeSession } from "../lib/learning/session.ts";

const START = new Date("2026-06-22T09:00:00.000Z");

function completedSession() {
  let session = createPracticeSession({
    id: "report-session",
    lesson: INTRODUCING_YOURSELF_LESSON,
    mode: "standard",
    modelId: "test-model",
    now: START,
  });
  for (let index = 0; index < 12; index += 1) {
    session = appendSessionTurn(session, {
      id: `turn-${index}`,
      role: "user",
      content: `I usually start work at nine. Example ${index}.`,
      createdAt: START.toISOString(),
    });
  }
  return endPracticeSession(session, INTRODUCING_YOURSELF_LESSON, new Date("2026-06-22T09:20:00.000Z"));
}

test("report session validation rejects malformed and oversized input", () => {
  const session = completedSession();
  assert.equal(isReportSession(session), true);
  assert.equal(isReportSession({ ...session, activeDurationMs: -1 }), false);
  assert.equal(isReportSession({ ...session, turns: Array.from({ length: 101 }, () => session.turns[0]) }), false);
  assert.equal(isReportSession({
    ...session,
    turns: [{ ...session.turns[0], speechMetrics: { responseDurationMs: -1 } }],
  }), false);
});

test("lesson report sends derived timing as fluency evidence without audio", async () => {
  const session = completedSession();
  const timedSession = {
    ...session,
    turns: session.turns.map((turn, index) => index === 0 ? {
      ...turn,
      speechMetrics: {
        responseDurationMs: 5_000,
        speakingDurationMs: 4_000,
        leadInDurationMs: 300,
        pauseCount: 1,
        totalPauseDurationMs: 1_000,
      },
    } : turn),
  };
  let providerRequest: { messages?: Array<{ content: string }> } | undefined;

  await createLessonReport(
    timedSession,
    INTRODUCING_YOURSELF_LESSON,
    { OPENAI_API_KEY: "test-key" },
    async (_url, init) => {
      providerRequest = JSON.parse(String(init?.body)) as { messages?: Array<{ content: string }> };
      return Response.json({
        choices: [{ message: { content: JSON.stringify({
          ratings: [
            { dimension: "fluency", rating: 3, evidence: "Measured answer timing.", suggestion: "Keep a steady pace." },
            { dimension: "accuracy", rating: 3, evidence: "Present tense was mostly consistent.", suggestion: "Check articles." },
            { dimension: "vocabulary", rating: 3, evidence: "Routine words were relevant.", suggestion: "Add frequency phrases." },
            { dimension: "responsiveness", rating: 3, evidence: "Answers addressed the prompts.", suggestion: "Add examples." },
          ],
          strengths: [],
          priorityErrors: [],
          nextGoal: "Use one sequencing phrase.",
          selectedExpressions: [],
        }) } }],
      });
    },
    new Date("2026-06-22T09:21:00.000Z"),
  );

  const reportInput = JSON.parse(providerRequest?.messages?.[1]?.content ?? "{}") as {
    session?: { speechTiming?: { measuredTurnCount: number } };
    transcript?: Array<{ speechMetrics?: { pauseCount: number }; audio?: unknown }>;
  };
  assert.equal(reportInput.session?.speechTiming?.measuredTurnCount, 1);
  assert.equal(reportInput.transcript?.[0].speechMetrics?.pauseCount, 1);
  assert.equal(reportInput.transcript?.[0].audio, undefined);
});

test("completed lesson report requires four evidence-based ratings", async () => {
  const session = completedSession();
  const response = await createLessonReport(
    session,
    INTRODUCING_YOURSELF_LESSON,
    { OPENAI_API_KEY: "test-key" },
    async () => Response.json({
      choices: [{ message: { content: JSON.stringify({
        ratings: [
          { dimension: "fluency", rating: 3, evidence: "You sustained twelve answers.", suggestion: "Use shorter pauses." },
          { dimension: "accuracy", rating: 4, evidence: "You used the present simple consistently.", suggestion: "Check articles." },
          { dimension: "vocabulary", rating: 3, evidence: "You used routine vocabulary.", suggestion: "Add frequency phrases." },
          { dimension: "responsiveness", rating: 4, evidence: "Your answers addressed each prompt.", suggestion: "Add one example." },
        ],
        strengths: ["Clear routine description", "Relevant answers"],
        priorityErrors: [],
        nextGoal: "Use three frequency expressions.",
        selectedExpressions: ["Most of the time"],
      }) } }],
    }),
    new Date("2026-06-22T09:21:00.000Z"),
  );

  assert.equal(response.source, "model");
  assert.equal(response.ratings?.length, 4);
  assert.equal(response.nextGoal, "Use three frequency expressions.");
});

test("provider failure produces a fallback without invented ratings", async () => {
  const session = completedSession();
  const report = await createLessonReport(
    session,
    INTRODUCING_YOURSELF_LESSON,
    { OPENAI_API_KEY: "test-key" },
    async () => new Response("unavailable", { status: 503 }),
    new Date("2026-06-22T09:21:00.000Z"),
  );

  assert.equal(report.source, "fallback");
  assert.equal(report.ratings, undefined);
  assert.match(report.strengths[0], /12 speaking turns/);
});

test("fallback report preserves recorded corrections as evidence", () => {
  const session = completedSession();
  const corrected = {
    ...session,
    turns: [{
      ...session.turns[0],
      content: "I go office every day.",
      corrected: "I go to the office every day.",
      feedback: "地點前需要使用 to。",
    }],
  };
  const report = createFallbackReport(corrected, INTRODUCING_YOURSELF_LESSON, START);

  assert.equal(report.priorityErrors[0].evidence, "I go office every day.");
  assert.equal(report.priorityErrors[0].suggestion, "地點前需要使用 to。");
});
