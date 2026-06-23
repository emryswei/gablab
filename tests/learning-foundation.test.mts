import test from "node:test";
import assert from "node:assert/strict";

import { INTRODUCING_YOURSELF_LESSON } from "../lib/learning/courses.ts";
import { calculateWeeklyProgress, getLocalWeekBounds } from "../lib/learning/progress.ts";
import {
  advanceVocabularyReview,
  createNewVocabularyReviewItems,
  createVocabularyReviewItem,
  getDueVocabularyReviewItems,
} from "../lib/learning/review.ts";
import {
  appendSessionTurn,
  createPracticeSession,
  endPracticeSession,
  getActiveDurationMs,
  pausePracticeSession,
  resumePracticeSession,
} from "../lib/learning/session.ts";
import {
  DEFAULT_LEARNING_SETTINGS,
  clearLearningSettings,
  getTranscriptRetentionCutoff,
  hasCurrentPrivacyConsent,
  loadLearningSettings,
  saveLearningSettings,
  shouldPurgeTranscript,
} from "../lib/learning/storage.ts";
import type { PracticeSession } from "../lib/learning/types.ts";

const START = new Date("2026-06-22T09:00:00.000Z");

function createSession(mode: "standard" | "quick" = "standard") {
  return createPracticeSession({
    id: `${mode}-session`,
    lesson: INTRODUCING_YOURSELF_LESSON,
    mode,
    modelId: "test-model",
    now: START,
  });
}

test("first lesson defines stable A2-B1 checkpoints and completion limits", () => {
  assert.equal(INTRODUCING_YOURSELF_LESSON.level, "A2-B1");
  assert.equal(INTRODUCING_YOURSELF_LESSON.checkpoints.length, 5);
  assert.deepEqual(INTRODUCING_YOURSELF_LESSON.standard, {
    minimumActiveMinutes: 20,
    targetActiveMinutes: 25,
    maximumActiveMinutes: 30,
    minimumLearnerTurns: 12,
  });
});

test("session timing excludes paused time", () => {
  const session = createSession();
  const paused = pausePracticeSession(session, new Date("2026-06-22T09:05:00.000Z"));
  const resumed = resumePracticeSession(paused, new Date("2026-06-22T09:15:00.000Z"));

  assert.equal(paused.activeDurationMs, 5 * 60_000);
  assert.equal(getActiveDurationMs(resumed, new Date("2026-06-22T09:20:00.000Z")), 10 * 60_000);
});

test("standard session remains incomplete until duration and turn thresholds are met", () => {
  let session = createSession();
  for (let index = 0; index < 12; index += 1) {
    session = appendSessionTurn(session, {
      id: `turn-${index}`,
      role: "user",
      content: `Answer ${index}`,
      createdAt: START.toISOString(),
    });
  }

  const early = endPracticeSession(
    session,
    INTRODUCING_YOURSELF_LESSON,
    new Date("2026-06-22T09:19:59.000Z"),
  );
  const completed = endPracticeSession(
    session,
    INTRODUCING_YOURSELF_LESSON,
    new Date("2026-06-22T09:20:00.000Z"),
  );

  assert.equal(early.status, "incomplete");
  assert.equal(completed.status, "completed");
});

test("weekly progress separates standard, quick, and incomplete sessions", () => {
  const now = new Date(2026, 5, 24, 12, 0, 0);
  const { start } = getLocalWeekBounds(now);
  const currentWeek = new Date(start.getTime() + 60_000).toISOString();
  const standard = { ...createSession(), status: "completed", completedAt: currentWeek, updatedAt: currentWeek };
  const quick = { ...createSession("quick"), status: "completed", completedAt: currentWeek, updatedAt: currentWeek };
  const incomplete = { ...createSession(), id: "incomplete", status: "incomplete", updatedAt: currentWeek };

  const progress = calculateWeeklyProgress(
    [standard, quick, incomplete] as PracticeSession[],
    now,
  );

  assert.equal(progress.completedStandardLessons, 1);
  assert.equal(progress.quickPracticeCount, 1);
  assert.equal(progress.incompleteSessionCount, 1);
});

test("weekly progress counts paused sessions as resumable", () => {
  const paused = {
    ...createSession(),
    status: "paused",
    activeSince: undefined,
  } as PracticeSession;

  assert.equal(calculateWeeklyProgress([paused], START).incompleteSessionCount, 1);
  assert.equal(calculateWeeklyProgress([createSession()], START).incompleteSessionCount, 1);
});

test("learning settings use defaults for invalid data and round-trip valid data", () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };

  assert.deepEqual(loadLearningSettings(storage), DEFAULT_LEARNING_SETTINGS);
  const settings = { ...DEFAULT_LEARNING_SETTINGS, speechRate: "slow" as const };
  saveLearningSettings(settings, storage);
  assert.deepEqual(loadLearningSettings(storage), settings);
  assert.equal(hasCurrentPrivacyConsent(settings), false);
  assert.equal(
    hasCurrentPrivacyConsent({
      ...settings,
      consentAcceptedAt: START.toISOString(),
      consentVersion: "privacy-v1",
    }),
    true,
  );

  values.set("gablab.learning.settings.v1", "not-json");
  assert.deepEqual(loadLearningSettings(storage), DEFAULT_LEARNING_SETTINGS);

  clearLearningSettings({ removeItem: (key: string) => values.delete(key) });
  assert.equal(values.size, 0);
});

test("transcript retention removes only completed sessions older than 30 days", () => {
  const now = new Date("2026-06-22T12:00:00.000Z");
  const cutoff = getTranscriptRetentionCutoff(now);
  const oldTimestamp = new Date("2026-05-01T12:00:00.000Z").toISOString();
  const completed = {
    ...createSession(),
    status: "completed",
    completedAt: oldTimestamp,
    updatedAt: oldTimestamp,
    turns: [{ id: "turn", role: "user", content: "Old transcript", createdAt: oldTimestamp }],
  } as PracticeSession;

  assert.equal(cutoff.toISOString(), "2026-05-23T12:00:00.000Z");
  assert.equal(shouldPurgeTranscript(completed, cutoff), true);
  assert.equal(shouldPurgeTranscript({ ...completed, status: "incomplete" }, cutoff), false);
  assert.equal(shouldPurgeTranscript({ ...completed, transcriptPurgedAt: now.toISOString() }, cutoff), false);
  assert.equal(shouldPurgeTranscript({ ...completed, turns: [] }, cutoff), false);
});

test("vocabulary review deduplicates expressions and follows day 1, 3, 7, and 14 intervals", () => {
  const item = createVocabularyReviewItem({
    expression: "  Most of   the time  ",
    lessonId: INTRODUCING_YOURSELF_LESSON.id,
    sessionId: "session-1",
    now: START,
  });
  assert.equal(item.expression, "Most of the time");
  assert.equal(item.dueAt, "2026-06-23T09:00:00.000Z");
  assert.deepEqual(
    createNewVocabularyReviewItems({
      expressions: ["most OF THE time", "Once a week"],
      existingItems: [item],
      lessonId: INTRODUCING_YOURSELF_LESSON.id,
      sessionId: "session-2",
      now: START,
    }).map((reviewItem) => reviewItem.expression),
    ["Once a week"],
  );

  const dayOne = advanceVocabularyReview(item, new Date("2026-06-23T09:00:00.000Z"));
  const dayThree = advanceVocabularyReview(dayOne, new Date("2026-06-25T09:00:00.000Z"));
  const daySeven = advanceVocabularyReview(dayThree, new Date("2026-06-29T09:00:00.000Z"));
  const completed = advanceVocabularyReview(daySeven, new Date("2026-07-06T09:00:00.000Z"));

  assert.equal(dayOne.dueAt, "2026-06-25T09:00:00.000Z");
  assert.equal(dayThree.dueAt, "2026-06-29T09:00:00.000Z");
  assert.equal(daySeven.dueAt, "2026-07-06T09:00:00.000Z");
  assert.equal(completed.completedAt, "2026-07-06T09:00:00.000Z");
  assert.deepEqual(getDueVocabularyReviewItems([dayOne], new Date("2026-06-24T09:00:00.000Z")), []);
  assert.deepEqual(getDueVocabularyReviewItems([dayOne], new Date("2026-06-25T09:00:00.000Z")), [dayOne]);
});
