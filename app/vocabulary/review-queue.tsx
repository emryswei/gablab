"use client";

import { useEffect, useState } from "react";

import { getDueVocabularyReviewItems, REVIEW_DAY_OFFSETS } from "@/lib/learning/review";
import { IndexedDbLearningRepository } from "@/lib/learning/storage";
import type { VocabularyReviewItem } from "@/lib/learning/types";
import styles from "./page.module.css";

function formatDueDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
  }).format(new Date(value));
}

export default function ReviewQueue() {
  const [repository] = useState(() => new IndexedDbLearningRepository());
  const [items, setItems] = useState<VocabularyReviewItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    repository
      .listVocabularyReviewItems()
      .then(setItems)
      .catch(() => setError("Local vocabulary review is unavailable in this browser."))
      .finally(() => setIsLoading(false));
  }, [repository]);

  const activeItems = items.filter((item) => !item.completedAt && item.dueAt);
  const dueItems = getDueVocabularyReviewItems(activeItems);
  const currentItem = dueItems[0];
  const nextItem = activeItems[0];

  const markReviewed = async () => {
    if (!currentItem || isSaving) return;
    setIsSaving(true);
    setError(null);
    try {
      const advanced = await repository.advanceVocabularyReviewItem(currentItem.id);
      if (advanced) {
        setItems((currentItems) =>
          currentItems
            .map((item) => (item.id === advanced.id ? advanced : item))
            .toSorted((left, right) => (left.dueAt ?? "9999").localeCompare(right.dueAt ?? "9999")),
        );
      }
    } catch {
      setError("Review progress could not be saved.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className={styles.reviewSection} aria-labelledby="lesson-review-title">
      <div className={styles.reviewHeader}>
        <div>
          <p>From speaking lessons</p>
          <h2 id="lesson-review-title">Expression review</h2>
        </div>
        {dueItems.length > 0 ? <span>{dueItems.length} due</span> : null}
      </div>

      {isLoading ? (
        <p className={styles.reviewMessage} role="status">Loading local review...</p>
      ) : error ? (
        <p className={styles.reviewError} role="status">{error}</p>
      ) : currentItem ? (
        <div className={styles.reviewCard}>
          <span>Day {REVIEW_DAY_OFFSETS[currentItem.stage]} review</span>
          <strong>{currentItem.expression}</strong>
          <p>Say the expression aloud in one complete sentence.</p>
          <button type="button" onClick={() => void markReviewed()} disabled={isSaving}>
            {isSaving ? "Saving..." : "I reviewed this"}
          </button>
        </div>
      ) : nextItem?.dueAt ? (
        <p className={styles.reviewMessage}>
          Nothing due today. Next review: <strong>{formatDueDate(nextItem.dueAt)}</strong>.
        </p>
      ) : (
        <p className={styles.reviewMessage}>
          Complete a speaking lesson to add useful expressions here.
        </p>
      )}
    </section>
  );
}
