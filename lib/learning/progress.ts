import type { PracticeSession, WeeklyProgress } from "./types.ts";

export function getLocalWeekBounds(now = new Date()) {
  const start = new Date(now);
  const dayFromMonday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - dayFromMonday);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 7);

  return { start, end };
}

export function calculateWeeklyProgress(
  sessions: PracticeSession[],
  now = new Date(),
): WeeklyProgress {
  const { start, end } = getLocalWeekBounds(now);
  const inCurrentWeek = sessions.filter((session) => {
    const timestamp = new Date(session.completedAt ?? session.updatedAt).getTime();
    return timestamp >= start.getTime() && timestamp < end.getTime();
  });

  return {
    weekStartsAt: start.toISOString(),
    weekEndsAt: end.toISOString(),
    completedStandardLessons: inCurrentWeek.filter(
      (session) => session.mode === "standard" && session.status === "completed",
    ).length,
    standardGoal: 3,
    quickPracticeCount: inCurrentWeek.filter(
      (session) => session.mode === "quick" && session.status === "completed",
    ).length,
    incompleteSessionCount: sessions.filter(
      (session) =>
        session.status === "incomplete" ||
        session.status === "paused" ||
        session.status === "in_progress",
    ).length,
  };
}
