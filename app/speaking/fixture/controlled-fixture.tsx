"use client";

import { useState } from "react";

import { runControlledLessonFixture, type ControlledFixtureResult } from "@/lib/learning/browser-fixture";
import { IndexedDbLearningRepository } from "@/lib/learning/storage";
import styles from "./page.module.css";

export default function ControlledFixture() {
  const [repository] = useState(() => new IndexedDbLearningRepository());
  const [result, setResult] = useState<ControlledFixtureResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runFixture = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setError(null);
    try {
      setResult(await runControlledLessonFixture(repository));
    } catch (fixtureError) {
      setError(fixtureError instanceof Error ? fixtureError.message : "Controlled fixture failed.");
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <section className={styles.fixturePanel} aria-labelledby="fixture-title">
      <span>Development only</span>
      <h2 id="fixture-title">Controlled lesson workflow</h2>
      <p>
        Runs twelve fixed learner transcripts through real IndexedDB checkpoints, completes the lesson,
        saves a deterministic report, and enqueues three vocabulary-review expressions. No microphone,
        model request, or raw audio is used. Fixture records are removed after verification.
      </p>

      <button
        type="button"
        data-testid="run-controlled-fixture"
        onClick={() => void runFixture()}
        disabled={isRunning}
      >
        {isRunning ? "Running fixture..." : "Run controlled fixture"}
      </button>

      {result ? (
        <div className={styles.fixtureResult} data-testid="controlled-fixture-result" role="status">
          <strong>Fixture passed</strong>
          <dl>
            <div><dt>Session</dt><dd>{result.status}</dd></div>
            <div><dt>Learner turns</dt><dd>{result.learnerTurnCount}</dd></div>
            <div><dt>Checkpoint saves</dt><dd>{result.checkpointSaveCount}</dd></div>
            <div><dt>Report ratings</dt><dd>{result.reportRatingCount}</dd></div>
            <div><dt>Review expressions</dt><dd>{result.reviewExpressionCount}</dd></div>
            <div><dt>Cleanup</dt><dd>{result.cleanupComplete ? "complete" : "failed"}</dd></div>
          </dl>
        </div>
      ) : null}
      {error ? <p className={styles.fixtureError} role="alert">{error}</p> : null}
    </section>
  );
}
