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

