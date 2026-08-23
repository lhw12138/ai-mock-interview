import type {
  CustomQuestion,
  DimensionScore,
  InterviewConfig,
  InterviewReport,
  InterviewSession,
  ModelConfig,
  Question,
} from "./types";

const STORAGE_KEY = "ai-mock-interview:sessions";
const CONFIG_KEY = "ai-mock-interview:config";
const BOOKMARK_KEY = "ai-mock-interview:bookmarks";
const CUSTOM_QUESTION_KEY = "ai-mock-interview:custom-questions";
const MODEL_CONFIG_KEY = "ai-mock-interview:model-config";

export function loadModelConfig(): ModelConfig | null {
  if (!isBrowser()) return null;

  try {
    const raw = window.localStorage.getItem(MODEL_CONFIG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ModelConfig>;
    return {
      baseUrl:
        typeof parsed.baseUrl === "string" ? parsed.baseUrl.trim() : "",
      model: typeof parsed.model === "string" ? parsed.model.trim() : "",
      apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey.trim() : "",
    };
  } catch {
    return null;
  }
}

export function saveModelConfig(config: ModelConfig): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(MODEL_CONFIG_KEY, JSON.stringify(config));
}

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function loadBookmarks(): Question[] {
  if (!isBrowser()) return [];

  try {
    const raw = window.localStorage.getItem(BOOKMARK_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Question[]) : [];
  } catch {
    return [];
  }
}

export function saveBookmark(question: Question): void {
  if (!isBrowser()) return;

  const bookmarks = loadBookmarks().filter((item) => item.id !== question.id);
  bookmarks.unshift(question);
  window.localStorage.setItem(BOOKMARK_KEY, JSON.stringify(bookmarks));
}

export function removeBookmark(questionId: number): void {
  if (!isBrowser()) return;

  const bookmarks = loadBookmarks().filter((item) => item.id !== questionId);
  window.localStorage.setItem(BOOKMARK_KEY, JSON.stringify(bookmarks));
}

export function isBookmarked(questionId: number): boolean {
  return loadBookmarks().some((item) => item.id === questionId);
}

export function loadCustomQuestions(): CustomQuestion[] {
  if (!isBrowser()) return [];

  try {
    const raw = window.localStorage.getItem(CUSTOM_QUESTION_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CustomQuestion[]) : [];
  } catch {
    return [];
  }
}

export function saveCustomQuestions(questions: CustomQuestion[]): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(CUSTOM_QUESTION_KEY, JSON.stringify(questions));
}

export function addCustomQuestion(question: CustomQuestion): void {
  const questions = loadCustomQuestions().filter((item) => item.id !== question.id);
  questions.unshift(question);
  saveCustomQuestions(questions);
}

export function updateCustomQuestion(question: CustomQuestion): void {
  const questions = loadCustomQuestions().map((item) =>
    item.id === question.id ? question : item,
  );
  saveCustomQuestions(questions);
}

export function deleteCustomQuestion(questionId: number): void {
  const questions = loadCustomQuestions().filter((item) => item.id !== questionId);
  saveCustomQuestions(questions);
}

export function loadSessions(): InterviewSession[] {
  if (!isBrowser()) return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as InterviewSession[]) : [];
  } catch {
    return [];
  }
}

export function saveSession(session: InterviewSession): void {
  if (!isBrowser()) return;

  const sessions = loadSessions().filter((item) => item.id !== session.id);
  sessions.unshift(session);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.slice(0, 20)));
}

export function getLatestSession(): InterviewSession | null {
  return loadSessions()[0] ?? null;
}

function isDimensionScore(value: unknown): value is DimensionScore {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<DimensionScore>;
  return typeof candidate.score === "number" && typeof candidate.comment === "string";
}

function isInterviewReport(value: unknown): value is InterviewReport {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<InterviewReport>;

  if (typeof candidate.totalScore !== "number") return false;
  if (!candidate.dimensionScores || typeof candidate.dimensionScores !== "object") {
    return false;
  }

  const dimensions = candidate.dimensionScores as unknown as Record<string, unknown>;
  const keys = Object.keys(dimensions);
  if (keys.length === 0 || !keys.every((key) => isDimensionScore(dimensions[key]))) {
    return false;
  }

  return (
    Array.isArray(candidate.perQuestion) &&
    typeof candidate.overallFeedback === "string" &&
    Array.isArray(candidate.improvementSuggestions)
  );
}

function isInterviewSession(value: unknown): value is InterviewSession {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<InterviewSession>;

  return (
    typeof candidate.id === "string" &&
    typeof candidate.createdAt === "string" &&
    typeof candidate.role === "string" &&
    typeof candidate.questionCount === "number" &&
    Array.isArray(candidate.questions) &&
    Array.isArray(candidate.conversation) &&
    isInterviewReport(candidate.report)
  );
}

export function getValidSessions(): InterviewSession[] {
  const sessions = loadSessions();
  const validSessions = sessions.filter(isInterviewSession);

  if (validSessions.length !== sessions.length) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(validSessions.slice(0, 20)));
    } catch {
      // Ignore write errors here; the invalid data will still be ignored.
    }
  }

  return validSessions.slice(0, 20);
}

export function getLatestValidSession(): InterviewSession | null {
  return getValidSessions()[0] ?? null;
}

export function getSessionById(id: string): InterviewSession | null {
  return getValidSessions().find((session) => session.id === id) ?? null;
}

export function deleteSession(id: string): void {
  if (!isBrowser()) return;

  const sessions = loadSessions().filter((session) => session.id !== id);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.slice(0, 20)));
}

export function saveInterviewConfig(config: InterviewConfig): void {
  if (!isBrowser()) return;
  const value = JSON.stringify(config);
  try {
    window.localStorage.setItem(CONFIG_KEY, value);
  } catch {
    // Ignore local storage errors and keep the session-only fallback below.
  }
  window.sessionStorage.setItem(CONFIG_KEY, value);
}

export function loadInterviewConfig(): InterviewConfig | null {
  if (!isBrowser()) return null;

  const read = (storage: Storage | null): InterviewConfig | null => {
    if (!storage) return null;
    try {
      const raw = storage.getItem(CONFIG_KEY);
      return raw ? (JSON.parse(raw) as InterviewConfig) : null;
    } catch {
      return null;
    }
  };

  try {
    return read(window.sessionStorage) ?? read(window.localStorage);
  } catch {
    return read(window.localStorage);
  }
}

export function clearInterviewConfig(): void {
  if (!isBrowser()) return;
  window.sessionStorage.removeItem(CONFIG_KEY);
  window.localStorage.removeItem(CONFIG_KEY);
}
