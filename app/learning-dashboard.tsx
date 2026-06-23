"use client";

import { ArrowRight, Clock3, Download, RotateCcw, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { INTRODUCING_YOURSELF_LESSON } from "@/lib/learning/courses";
import { calculateWeeklyProgress } from "@/lib/learning/progress";
import {
  clearLearningSettings,
  getTranscriptRetentionCutoff,
  IndexedDbLearningRepository,
  loadLearningSettings,
} from "@/lib/learning/storage";
import type { WeeklyProgress } from "@/lib/learning/types";
import styles from "./page.module.css";

const EMPTY_PROGRESS: WeeklyProgress = {
  weekStartsAt: "",
  weekEndsAt: "",
  completedStandardLessons: 0,
  standardGoal: 3,
  quickPracticeCount: 0,
  incompleteSessionCount: 0,
};

export default function LearningDashboard() {
  const [progress, setProgress] = useState<WeeklyProgress>(EMPTY_PROGRESS);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [resumableSessionId, setResumableSessionId] = useState<string | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState(false);
  const [dataNotice, setDataNotice] = useState<string | null>(null);
  const [repository] = useState(() => new IndexedDbLearningRepository());

  useEffect(() => {
    repository
      .purgeExpiredTranscripts(getTranscriptRetentionCutoff())
      .then(() => repository.listSessions())
      .then((sessions) => {
        setProgress(calculateWeeklyProgress(sessions));
        const resumableSession = sessions.find(
          (session) =>
            session.lessonId === INTRODUCING_YOURSELF_LESSON.id &&
            (session.status === "paused" ||
              session.status === "incomplete" ||
              session.status === "in_progress"),
        );
        setResumableSessionId(resumableSession?.id ?? null);
      })
      .catch(() => setStorageAvailable(false));
  }, [repository]);

  const exportLearningData = async () => {
    try {
      const payload = {
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        settings: loadLearningSettings(),
        profile: await repository.getProfile(),
        sessions: await repository.listSessions(),
        reviewItems: await repository.listVocabularyReviewItems(),
      };
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }),
      );
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `gablab-learning-data-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setDataNotice("Learning data exported.");
    } catch {
      setDataNotice("Learning data could not be exported.");
    }
  };

  const deleteLearningData = async () => {
    if (!deleteConfirmation) {
      setDeleteConfirmation(true);
      setDataNotice("Select delete again to permanently remove all local learning data.");
      return;
    }

    try {
      await repository.clearAllLearningData();
      clearLearningSettings();
      setProgress(calculateWeeklyProgress([]));
      setResumableSessionId(null);
      setDeleteConfirmation(false);
      setDataNotice("All local learning data deleted.");
    } catch {
      setDataNotice("Local learning data could not be deleted.");
    }
  };

  const lesson = INTRODUCING_YOURSELF_LESSON;
  const progressPercent = Math.min(100, (progress.completedStandardLessons / progress.standardGoal) * 100);

  return (
    <section className={styles.dashboard} aria-labelledby="weekly-progress-title">
      <div className={styles.progressCard}>
        <div>
          <p className={styles.cardEyebrow}>This week</p>
          <h2 id="weekly-progress-title">
            {progress.completedStandardLessons}/{progress.standardGoal} standard lessons
          </h2>
          <p className={styles.cardText}>
            Complete three focused English speaking lessons between Monday and Sunday.
          </p>
        </div>
        <div
          className={styles.progressTrack}
          role="progressbar"
          aria-label="Weekly standard lesson progress"
          aria-valuemin={0}
          aria-valuemax={progress.standardGoal}
          aria-valuenow={progress.completedStandardLessons}
        >
          <span style={{ width: `${progressPercent}%` }} />
        </div>
        <div className={styles.progressMeta}>
          <span>
            <RotateCcw size={15} aria-hidden="true" /> {progress.quickPracticeCount} quick practices
          </span>
          <span>{progress.incompleteSessionCount} sessions to continue</span>
        </div>
        {!storageAvailable ? (
          <p className={styles.storageWarning} role="status">
            Local learning storage is unavailable. Practice can continue, but progress will not be saved.
          </p>
        ) : null}
      </div>

      <article className={styles.lessonCard}>
        <div className={styles.lessonHeader}>
          <span>Week {lesson.week} · Lesson {lesson.sequence}</span>
          <span>{lesson.level}</span>
        </div>
        <h2>{lesson.title}</h2>
        <p>{lesson.summary}</p>
        <div className={styles.lessonMeta}>
          <span>
            <Clock3 size={15} aria-hidden="true" /> {lesson.standard.minimumActiveMinutes}-
            {lesson.standard.maximumActiveMinutes} min
          </span>
          <span>{lesson.standard.minimumLearnerTurns}+ speaking turns</span>
        </div>
        <Link
          href={`/speaking?lesson=${lesson.id}${resumableSessionId ? `&session=${resumableSessionId}` : ""}`}
          className={styles.lessonAction}
        >
          {resumableSessionId ? "Continue lesson" : "Start lesson"} <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </article>

      <div className={styles.dataCard}>
        <div>
          <p className={styles.cardEyebrow}>Local data</p>
          <h2>Privacy controls</h2>
          <p>Export or permanently delete learning records stored in this browser.</p>
        </div>
        <div className={styles.dataActions}>
          <button type="button" onClick={() => void exportLearningData()}>
            <Download size={16} aria-hidden="true" /> Export JSON
          </button>
          <button
            type="button"
            className={deleteConfirmation ? styles.deleteButtonConfirm : undefined}
            onClick={() => void deleteLearningData()}
          >
            <Trash2 size={16} aria-hidden="true" />
            {deleteConfirmation ? "Confirm delete all" : "Delete local data"}
          </button>
        </div>
        {dataNotice ? <p className={styles.dataNotice} role="status">{dataNotice}</p> : null}
      </div>
    </section>
  );
}
