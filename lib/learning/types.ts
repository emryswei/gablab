export const LEARNING_SCHEMA_VERSION = 1 as const;
export const CURRENT_RUBRIC_VERSION = "speaking-rubric-v1";
export const PRIVACY_CONSENT_VERSION = "privacy-v1";

export type PracticeMode = "standard" | "quick";
export type SessionStatus = "in_progress" | "paused" | "incomplete" | "completed";
export type SkillDimension = "fluency" | "accuracy" | "vocabulary" | "responsiveness";
export type CoachingSeverity = "blocking" | "recurring" | "minor";
export type VocabularyReviewStage = 0 | 1 | 2 | 3;

export type LessonCheckpoint = {
  id: string;
  title: string;
  promptGoal: string;
};

export type LessonDefinition = {
  id: string;
  version: string;
  sequence: number;
  week: number;
  title: string;
  summary: string;
  level: "A2-B1";
  abilityGoal: "describe" | "narrate" | "explain" | "solve";
  checkpoints: LessonCheckpoint[];
  suggestedExpressions: string[];
  standard: {
    minimumActiveMinutes: number;
    targetActiveMinutes: number;
    maximumActiveMinutes: number;
    minimumLearnerTurns: number;
  };
  quick: {
    minimumActiveMinutes: number;
    maximumActiveMinutes: number;
  };
};

export type SessionTurn = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  corrected?: string;
  feedback?: string;
  severity?: CoachingSeverity;
};

export type SessionObservation = {
  id: string;
  turnId?: string;
  category: string;
  evidence: string;
  suggestion: string;
  severity: CoachingSeverity;
};

export type DimensionRating = {
  dimension: SkillDimension;
  rating: 1 | 2 | 3 | 4 | 5;
  evidence: string;
  suggestion: string;
};

export type PracticeReport = {
  rubricVersion: string;
  generatedAt: string;
  source: "model" | "fallback";
  ratings?: DimensionRating[];
  strengths: string[];
  priorityErrors: SessionObservation[];
  nextGoal: string;
  selectedExpressions: string[];
};

export type VocabularyReviewItem = {
  schemaVersion: typeof LEARNING_SCHEMA_VERSION;
  id: string;
  expression: string;
  expressionKey: string;
  sourceLessonId: string;
  sourceSessionId: string;
  stage: VocabularyReviewStage;
  reviewCount: number;
  createdAt: string;
  updatedAt: string;
  dueAt?: string;
  completedAt?: string;
};

export type PracticeSession = {
  schemaVersion: typeof LEARNING_SCHEMA_VERSION;
  id: string;
  lessonId: string;
  lessonVersion: string;
  rubricVersion: string;
  modelId: string;
  mode: PracticeMode;
  status: SessionStatus;
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  activeSince?: string;
  activeDurationMs: number;
  learnerTurnCount: number;
  completedCheckpointIds: string[];
  turns: SessionTurn[];
  observations: SessionObservation[];
  report?: PracticeReport;
  transcriptPurgedAt?: string;
};

export type LearningSettings = {
  schemaVersion: typeof LEARNING_SCHEMA_VERSION;
  consentAcceptedAt?: string;
  consentVersion?: typeof PRIVACY_CONSENT_VERSION;
  preferredAccent: "en-GB" | "en-US" | "en-AU";
  speechRate: "normal" | "slow";
};

export type LearnerProfile = {
  schemaVersion: typeof LEARNING_SCHEMA_VERSION;
  id: "local-profile";
  learnerName?: string;
  englishGoal?: string;
  updatedAt: string;
};

export type WeeklyProgress = {
  weekStartsAt: string;
  weekEndsAt: string;
  completedStandardLessons: number;
  standardGoal: 3;
  quickPracticeCount: number;
  incompleteSessionCount: number;
};
