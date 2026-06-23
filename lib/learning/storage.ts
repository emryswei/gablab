import { advanceVocabularyReview, createNewVocabularyReviewItems } from "./review.ts";
import type {
  LearnerProfile,
  LearningSettings,
  PracticeSession,
  VocabularyReviewItem,
} from "./types.ts";
import { LEARNING_SCHEMA_VERSION, PRIVACY_CONSENT_VERSION } from "./types.ts";

const SETTINGS_KEY = "gablab.learning.settings.v1";
const DATABASE_NAME = "gablab-learning";
const DATABASE_VERSION = 3;
const SESSION_STORE = "sessions";
const PROFILE_STORE = "profiles";
const REVIEW_STORE = "reviewItems";
export const TRANSCRIPT_RETENTION_DAYS = 30;

export const DEFAULT_LEARNING_SETTINGS: LearningSettings = {
  schemaVersion: LEARNING_SCHEMA_VERSION,
  preferredAccent: "en-GB",
  speechRate: "normal",
};

export function loadLearningSettings(storage: Pick<Storage, "getItem"> = localStorage): LearningSettings {
  const raw = storage.getItem(SETTINGS_KEY);
  if (!raw) return DEFAULT_LEARNING_SETTINGS;

  try {
    const parsed = JSON.parse(raw) as Partial<LearningSettings>;
    if (parsed.schemaVersion !== LEARNING_SCHEMA_VERSION) return DEFAULT_LEARNING_SETTINGS;
    return {
      ...DEFAULT_LEARNING_SETTINGS,
      ...parsed,
    };
  } catch {
    return DEFAULT_LEARNING_SETTINGS;
  }
}

export function saveLearningSettings(
  settings: LearningSettings,
  storage: Pick<Storage, "setItem"> = localStorage,
) {
  storage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function clearLearningSettings(storage: Pick<Storage, "removeItem"> = localStorage) {
  storage.removeItem(SETTINGS_KEY);
}

export function hasCurrentPrivacyConsent(settings: LearningSettings) {
  return Boolean(
    settings.consentAcceptedAt && settings.consentVersion === PRIVACY_CONSENT_VERSION,
  );
}

export function getTranscriptRetentionCutoff(now = new Date()) {
  return new Date(now.getTime() - TRANSCRIPT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
}

export function shouldPurgeTranscript(session: PracticeSession, cutoff: Date) {
  const referenceTime = session.completedAt ?? session.updatedAt;
  return (
    session.status === "completed" &&
    session.turns.length > 0 &&
    !session.transcriptPurgedAt &&
    new Date(referenceTime).getTime() < cutoff.getTime()
  );
}

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."));
  });
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted."));
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed."));
  });
}

export function openLearningDatabase(indexedDb: IDBFactory = indexedDB) {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDb.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(SESSION_STORE)) {
        const store = request.result.createObjectStore(SESSION_STORE, { keyPath: "id" });
        store.createIndex("updatedAt", "updatedAt");
        store.createIndex("status", "status");
      }
      if (!request.result.objectStoreNames.contains(PROFILE_STORE)) {
        request.result.createObjectStore(PROFILE_STORE, { keyPath: "id" });
      }
      if (!request.result.objectStoreNames.contains(REVIEW_STORE)) {
        const store = request.result.createObjectStore(REVIEW_STORE, { keyPath: "id" });
        store.createIndex("dueAt", "dueAt");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Unable to open learning storage."));
  });
}

export class IndexedDbLearningRepository {
  private readonly openDatabase: typeof openLearningDatabase;

  constructor(openDatabase = openLearningDatabase) {
    this.openDatabase = openDatabase;
  }

  async saveSession(session: PracticeSession) {
    const database = await this.openDatabase();
    try {
      const transaction = database.transaction(SESSION_STORE, "readwrite");
      transaction.objectStore(SESSION_STORE).put(session);
      await transactionDone(transaction);
    } finally {
      database.close();
    }
  }

  async getSession(sessionId: string) {
    const database = await this.openDatabase();
    try {
      const transaction = database.transaction(SESSION_STORE, "readonly");
      return await requestResult<PracticeSession | undefined>(
        transaction.objectStore(SESSION_STORE).get(sessionId),
      );
    } finally {
      database.close();
    }
  }

  async listSessions() {
    const database = await this.openDatabase();
    try {
      const transaction = database.transaction(SESSION_STORE, "readonly");
      const sessions = await requestResult<PracticeSession[]>(transaction.objectStore(SESSION_STORE).getAll());
      return sessions.toSorted((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    } finally {
      database.close();
    }
  }

  async saveProfile(profile: LearnerProfile) {
    const database = await this.openDatabase();
    try {
      const transaction = database.transaction(PROFILE_STORE, "readwrite");
      transaction.objectStore(PROFILE_STORE).put(profile);
      await transactionDone(transaction);
    } finally {
      database.close();
    }
  }

  async getProfile() {
    const database = await this.openDatabase();
    try {
      const transaction = database.transaction(PROFILE_STORE, "readonly");
      return await requestResult<LearnerProfile | undefined>(
        transaction.objectStore(PROFILE_STORE).get("local-profile"),
      );
    } finally {
      database.close();
    }
  }

  async saveVocabularyReviewItems(items: VocabularyReviewItem[]) {
    if (items.length === 0) return;
    const database = await this.openDatabase();
    try {
      const transaction = database.transaction(REVIEW_STORE, "readwrite");
      const store = transaction.objectStore(REVIEW_STORE);
      for (const item of items) store.put(item);
      await transactionDone(transaction);
    } finally {
      database.close();
    }
  }

  async listVocabularyReviewItems() {
    const database = await this.openDatabase();
    try {
      const transaction = database.transaction(REVIEW_STORE, "readonly");
      const items = await requestResult<VocabularyReviewItem[]>(
        transaction.objectStore(REVIEW_STORE).getAll(),
      );
      return items.toSorted((left, right) => (left.dueAt ?? "9999").localeCompare(right.dueAt ?? "9999"));
    } finally {
      database.close();
    }
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
    const existingItems = await this.listVocabularyReviewItems();
    const newItems = createNewVocabularyReviewItems({
      expressions,
      existingItems,
      lessonId,
      sessionId,
      now,
    });
    await this.saveVocabularyReviewItems(newItems);
    return newItems;
  }

  async advanceVocabularyReviewItem(itemId: string, now = new Date()) {
    const database = await this.openDatabase();
    try {
      const transaction = database.transaction(REVIEW_STORE, "readonly");
      const item = await requestResult<VocabularyReviewItem | undefined>(
        transaction.objectStore(REVIEW_STORE).get(itemId),
      );
      if (!item) return undefined;
      const advanced = advanceVocabularyReview(item, now);
      await this.saveVocabularyReviewItems([advanced]);
      return advanced;
    } finally {
      database.close();
    }
  }

  async purgeExpiredTranscripts(cutoff: Date, now = new Date()) {
    const sessions = await this.listSessions();
    const expired = sessions.filter((session) => shouldPurgeTranscript(session, cutoff));

    for (const session of expired) {
      await this.saveSession({
        ...session,
        turns: [],
        transcriptPurgedAt: now.toISOString(),
      });
    }

    return expired.length;
  }

  async clearAllLearningData() {
    const database = await this.openDatabase();
    try {
      const transaction = database.transaction([SESSION_STORE, PROFILE_STORE, REVIEW_STORE], "readwrite");
      transaction.objectStore(SESSION_STORE).clear();
      transaction.objectStore(PROFILE_STORE).clear();
      transaction.objectStore(REVIEW_STORE).clear();
      await transactionDone(transaction);
    } finally {
      database.close();
    }
  }
}
