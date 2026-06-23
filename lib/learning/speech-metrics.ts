import type { SessionTurn, TurnSpeechMetrics } from "./types.ts";

export const SPEECH_PAUSE_THRESHOLD_MS = 600;
export const LEARNER_SPEECH_ENERGY_THRESHOLD = 0.014;

export type SpeechTimingTracker = {
  captureStartedAt: number;
  firstSpeechAt?: number;
  lastSpeechAt?: number;
  pauseCount: number;
  totalPauseDurationMs: number;
};

export type SessionSpeechMetricsSummary = {
  measuredTurnCount: number;
  averageResponseDurationMs: number;
  averagePauseCount: number;
  totalPauseDurationMs: number;
};

export function createSpeechTimingTracker(captureStartedAt: number): SpeechTimingTracker {
  return {
    captureStartedAt,
    pauseCount: 0,
    totalPauseDurationMs: 0,
  };
}

export function recordSpeechActivity(tracker: SpeechTimingTracker, now: number) {
  if (tracker.firstSpeechAt === undefined) {
    tracker.firstSpeechAt = now;
    tracker.lastSpeechAt = now;
    return;
  }

  const previousActivityAt = tracker.lastSpeechAt ?? now;
  const gapMs = Math.max(0, now - previousActivityAt);
  if (gapMs >= SPEECH_PAUSE_THRESHOLD_MS) {
    tracker.pauseCount += 1;
    tracker.totalPauseDurationMs += gapMs;
  }
  tracker.lastSpeechAt = now;
}

export function finalizeSpeechTiming(tracker: SpeechTimingTracker | null): TurnSpeechMetrics | undefined {
  if (!tracker || tracker.firstSpeechAt === undefined || tracker.lastSpeechAt === undefined) {
    return undefined;
  }

  const responseDurationMs = Math.max(0, Math.round(tracker.lastSpeechAt - tracker.firstSpeechAt));
  const totalPauseDurationMs = Math.min(responseDurationMs, Math.round(tracker.totalPauseDurationMs));
  return {
    responseDurationMs,
    speakingDurationMs: Math.max(0, responseDurationMs - totalPauseDurationMs),
    leadInDurationMs: Math.max(0, Math.round(tracker.firstSpeechAt - tracker.captureStartedAt)),
    pauseCount: tracker.pauseCount,
    totalPauseDurationMs,
  };
}

export function isTurnSpeechMetrics(value: unknown): value is TurnSpeechMetrics {
  if (!value || typeof value !== "object") return false;
  const metrics = value as Partial<TurnSpeechMetrics>;
  return (
    Number.isFinite(metrics.responseDurationMs) &&
    Number(metrics.responseDurationMs) >= 0 &&
    Number.isFinite(metrics.speakingDurationMs) &&
    Number(metrics.speakingDurationMs) >= 0 &&
    Number(metrics.speakingDurationMs) <= Number(metrics.responseDurationMs) &&
    Number.isFinite(metrics.leadInDurationMs) &&
    Number(metrics.leadInDurationMs) >= 0 &&
    Number.isInteger(metrics.pauseCount) &&
    Number(metrics.pauseCount) >= 0 &&
    Number.isFinite(metrics.totalPauseDurationMs) &&
    Number(metrics.totalPauseDurationMs) >= 0 &&
    Number(metrics.totalPauseDurationMs) <= Number(metrics.responseDurationMs)
  );
}

export function summarizeSessionSpeechMetrics(turns: SessionTurn[]): SessionSpeechMetricsSummary | undefined {
  const measuredTurns = turns.flatMap((turn) =>
    turn.role === "user" && turn.speechMetrics ? [turn.speechMetrics] : [],
  );
  if (measuredTurns.length === 0) return undefined;

  const totals = measuredTurns.reduce(
    (summary, metrics) => ({
      responseDurationMs: summary.responseDurationMs + metrics.responseDurationMs,
      pauseCount: summary.pauseCount + metrics.pauseCount,
      totalPauseDurationMs: summary.totalPauseDurationMs + metrics.totalPauseDurationMs,
    }),
    { responseDurationMs: 0, pauseCount: 0, totalPauseDurationMs: 0 },
  );

  return {
    measuredTurnCount: measuredTurns.length,
    averageResponseDurationMs: Math.round(totals.responseDurationMs / measuredTurns.length),
    averagePauseCount: Number((totals.pauseCount / measuredTurns.length).toFixed(1)),
    totalPauseDurationMs: totals.totalPauseDurationMs,
  };
}
