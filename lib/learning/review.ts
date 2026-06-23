import { LEARNING_SCHEMA_VERSION } from "./types.ts";
import type { VocabularyReviewItem, VocabularyReviewStage } from "./types.ts";

export const REVIEW_DAY_OFFSETS = [1, 3, 7, 14] as const;

const DAY_MS = 24 * 60 * 60 * 1000;

export function normalizeReviewExpression(expression: string) {
  return expression.trim().replace(/\s+/g, " ").toLocaleLowerCase("en");
}

function getDueAt(now: Date, daysUntilDue: number) {
  return new Date(now.getTime() + daysUntilDue * DAY_MS).toISOString();
}

export function createVocabularyReviewItem({
  expression,
  lessonId,
  sessionId,
  now = new Date(),
}: {
  expression: string;
  lessonId: string;
  sessionId: string;
  now?: Date;
}): VocabularyReviewItem {
  const normalizedExpression = expression.trim().replace(/\s+/g, " ");
  const expressionKey = normalizeReviewExpression(normalizedExpression);
  const timestamp = now.toISOString();

  return {
    schemaVersion: LEARNING_SCHEMA_VERSION,
    id: `review:${expressionKey}`,
    expression: normalizedExpression,
    expressionKey,
    sourceLessonId: lessonId,
    sourceSessionId: sessionId,
    stage: 0,
    reviewCount: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
    dueAt: getDueAt(now, REVIEW_DAY_OFFSETS[0]),
  };
}

export function createNewVocabularyReviewItems({
  expressions,
  existingItems,
  lessonId,
  sessionId,
  now = new Date(),
}: {
  expressions: string[];
  existingItems: VocabularyReviewItem[];
  lessonId: string;
  sessionId: string;
  now?: Date;
}) {
  const existingKeys = new Set(existingItems.map((item) => item.expressionKey));
  const newItems: VocabularyReviewItem[] = [];

  for (const expression of expressions) {
    const expressionKey = normalizeReviewExpression(expression);
    if (!expressionKey || existingKeys.has(expressionKey)) continue;
    existingKeys.add(expressionKey);
    newItems.push(createVocabularyReviewItem({ expression, lessonId, sessionId, now }));
  }

  return newItems;
}

export function advanceVocabularyReview(item: VocabularyReviewItem, now = new Date()) {
  if (item.completedAt) return item;

  const timestamp = now.toISOString();
  if (item.stage === REVIEW_DAY_OFFSETS.length - 1) {
    return {
      ...item,
      reviewCount: item.reviewCount + 1,
      updatedAt: timestamp,
      dueAt: undefined,
      completedAt: timestamp,
    };
  }

  const nextStage = (item.stage + 1) as VocabularyReviewStage;
  const daysUntilNextReview = REVIEW_DAY_OFFSETS[nextStage] - REVIEW_DAY_OFFSETS[item.stage];
  return {
    ...item,
    stage: nextStage,
    reviewCount: item.reviewCount + 1,
    updatedAt: timestamp,
    dueAt: getDueAt(now, daysUntilNextReview),
  };
}

export function getDueVocabularyReviewItems(items: VocabularyReviewItem[], now = new Date()) {
  const nowTime = now.getTime();
  return items
    .filter((item) => !item.completedAt && item.dueAt && new Date(item.dueAt).getTime() <= nowTime)
    .toSorted((left, right) => (left.dueAt ?? "").localeCompare(right.dueAt ?? ""));
}
