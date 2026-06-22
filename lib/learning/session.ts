import type { LessonDefinition, PracticeMode, PracticeSession, SessionTurn } from "./types.ts";
import { CURRENT_RUBRIC_VERSION, LEARNING_SCHEMA_VERSION } from "./types.ts";

type CreatePracticeSessionInput = {
  id: string;
  lesson: LessonDefinition;
  mode: PracticeMode;
  modelId: string;
  now?: Date;
};

function elapsedMs(startedAt: string, now: Date) {
  return Math.max(0, now.getTime() - new Date(startedAt).getTime());
}

function closeActiveSegment(session: PracticeSession, now: Date) {
  if (!session.activeSince) return session.activeDurationMs;
  return session.activeDurationMs + elapsedMs(session.activeSince, now);
}

export function createPracticeSession({
  id,
  lesson,
  mode,
  modelId,
  now = new Date(),
}: CreatePracticeSessionInput): PracticeSession {
  const timestamp = now.toISOString();
  return {
    schemaVersion: LEARNING_SCHEMA_VERSION,
    id,
    lessonId: lesson.id,
    lessonVersion: lesson.version,
    rubricVersion: CURRENT_RUBRIC_VERSION,
    modelId,
    mode,
    status: "in_progress",
    startedAt: timestamp,
    updatedAt: timestamp,
    activeSince: timestamp,
    activeDurationMs: 0,
    learnerTurnCount: 0,
    completedCheckpointIds: [],
    turns: [],
    observations: [],
  };
}

export function getActiveDurationMs(session: PracticeSession, now = new Date()) {
  return closeActiveSegment(session, now);
}

export function pausePracticeSession(session: PracticeSession, now = new Date()): PracticeSession {
  if (session.status !== "in_progress") return session;
  return {
    ...session,
    status: "paused",
    activeDurationMs: closeActiveSegment(session, now),
    activeSince: undefined,
    updatedAt: now.toISOString(),
  };
}

export function resumePracticeSession(session: PracticeSession, now = new Date()): PracticeSession {
  if (session.status === "completed") return session;
  return {
    ...session,
    status: "in_progress",
    activeSince: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

export function appendSessionTurn(
  session: PracticeSession,
  turn: SessionTurn,
  now = new Date(),
): PracticeSession {
  if (session.status !== "in_progress") return session;
  return {
    ...session,
    turns: [...session.turns, turn],
    learnerTurnCount: session.learnerTurnCount + (turn.role === "user" ? 1 : 0),
    updatedAt: now.toISOString(),
  };
}

export function completeCheckpoint(
  session: PracticeSession,
  checkpointId: string,
  now = new Date(),
): PracticeSession {
  if (session.completedCheckpointIds.includes(checkpointId)) return session;
  return {
    ...session,
    completedCheckpointIds: [...session.completedCheckpointIds, checkpointId],
    updatedAt: now.toISOString(),
  };
}

export function meetsCompletionThreshold(
  session: PracticeSession,
  lesson: LessonDefinition,
  now = new Date(),
) {
  const activeMinutes = getActiveDurationMs(session, now) / 60_000;
  if (session.mode === "quick") {
    return activeMinutes >= lesson.quick.minimumActiveMinutes;
  }
  return (
    activeMinutes >= lesson.standard.minimumActiveMinutes &&
    session.learnerTurnCount >= lesson.standard.minimumLearnerTurns
  );
}

export function endPracticeSession(
  session: PracticeSession,
  lesson: LessonDefinition,
  now = new Date(),
): PracticeSession {
  const completed = meetsCompletionThreshold(session, lesson, now);
  return {
    ...session,
    status: completed ? "completed" : "incomplete",
    activeDurationMs: closeActiveSegment(session, now),
    activeSince: undefined,
    updatedAt: now.toISOString(),
    ...(completed ? { completedAt: now.toISOString() } : {}),
  };
}

