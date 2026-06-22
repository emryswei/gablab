import type { LessonDefinition } from "./types.ts";

export const INTRODUCING_YOURSELF_LESSON: LessonDefinition = {
  id: "introducing-yourself-and-daily-life",
  version: "1.0.0",
  sequence: 1,
  week: 1,
  title: "Introducing Yourself and Daily Life",
  summary: "Introduce yourself naturally and describe a typical working day.",
  level: "A2-B1",
  abilityGoal: "describe",
  checkpoints: [
    {
      id: "background",
      title: "Personal background",
      promptGoal: "Help the learner introduce where they are from and what they do.",
    },
    {
      id: "typical-day",
      title: "Typical day",
      promptGoal: "Ask the learner to describe a normal weekday in sequence.",
    },
    {
      id: "frequency",
      title: "Frequency and routines",
      promptGoal: "Elicit frequency expressions such as usually, often, and once a week.",
    },
    {
      id: "interests",
      title: "Interests",
      promptGoal: "Explore one interest with reasons and a concrete example.",
    },
    {
      id: "next-goal",
      title: "English goal",
      promptGoal: "Ask what the learner wants to do more confidently in English.",
    },
  ],
  suggestedExpressions: [
    "I usually start my day by...",
    "Most of the time...",
    "One thing I enjoy is...",
    "I would like to become more confident in...",
  ],
  standard: {
    minimumActiveMinutes: 20,
    targetActiveMinutes: 25,
    maximumActiveMinutes: 30,
    minimumLearnerTurns: 12,
  },
  quick: {
    minimumActiveMinutes: 5,
    maximumActiveMinutes: 10,
  },
};

export const LESSONS = [INTRODUCING_YOURSELF_LESSON] as const;

export function getLessonById(lessonId: string) {
  return LESSONS.find((lesson) => lesson.id === lessonId);
}

