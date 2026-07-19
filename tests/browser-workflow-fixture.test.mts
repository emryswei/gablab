import assert from "node:assert/strict";
import test from "node:test";

import {
  CONTROLLED_FIXTURE_SESSION_ID,
  CONTROLLED_TRANSCRIPTS,
  runControlledLessonFixture,
} from "../lib/learning/browser-fixture.ts";
import { createVocabularyReviewItem } from "../lib/learning/review.ts";
import type { PracticeSession, VocabularyReviewItem } from "../lib/learning/types.ts";

class MemoryFixtureRepository {
  sessions = new Map<string, PracticeSession>();
  reviewItems: VocabularyReviewItem[] = [];
  saveCount = 0;

  async saveSession(session: PracticeSession) {
    this.sessions.set(session.id, structuredClone(session));
    this.saveCount += 1;
  }

  async getSession(sessionId: string) {
    return this.sessions.get(sessionId);
  }

  async deleteSession(sessionId: string) {
    this.sessions.delete(sessionId);
  }

  async enqueueVocabularyReviewExpressions({
    expressions,
    lessonId,
    sessionId,
    now = new Date(),
  }: {
    expressions: string[];
    lessonId: string;
    sessionId: string;
    now?: Date;
  }) {
    this.reviewItems = expressions.map((expression) =>
      createVocabularyReviewItem({ expression, lessonId, sessionId, now }),
    );
    return this.reviewItems;
  }

  async listVocabularyReviewItems() {
    return this.reviewItems;
  }

  async deleteVocabularyReviewItemsBySourceSession(sessionId: string) {
    const initialLength = this.reviewItems.length;
    this.reviewItems = this.reviewItems.filter((item) => item.sourceSessionId !== sessionId);
    return initialLength - this.reviewItems.length;
  }
}

test("controlled browser fixture persists turns, report, and vocabulary review", async () => {
  const repository = new MemoryFixtureRepository();
  const result = await runControlledLessonFixture(
    repository,
    new Date("2026-06-23T12:00:00.000Z"),
  );

  assert.equal(result.sessionId, CONTROLLED_FIXTURE_SESSION_ID);
  assert.equal(result.status, "completed");
  assert.equal(result.learnerTurnCount, CONTROLLED_TRANSCRIPTS.length);
  assert.equal(result.checkpointSaveCount, CONTROLLED_TRANSCRIPTS.length + 3);
  assert.equal(result.reportRatingCount, 4);
  assert.equal(result.reviewExpressionCount, 3);
  assert.equal(result.cleanupComplete, true);
  assert.equal(repository.saveCount, CONTROLLED_TRANSCRIPTS.length + 3);
  assert.equal(repository.sessions.has(CONTROLLED_FIXTURE_SESSION_ID), false);
  assert.equal(repository.reviewItems.length, 0);
});
