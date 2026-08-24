import type {
  CustomQuestion,
  DimensionScore,
  InterviewConfig,
  InterviewReport,
  InterviewProgress,
  InterviewSession,
  ModelConfig,
  Question,
} from "./types";

const STORAGE_KEY = "ai-mock-interview:sessions";
const CONFIG_KEY = "ai-mock-interview:config";
const BOOKMARK_KEY = "ai-mock-interview:bookmarks";
const CUSTOM_QUESTION_KEY = "ai-mock-interview:custom-questions";
const MODEL_CONFIG_KEY = "ai-mock-interview:model-config";
const MODEL_API_KEY = "ai-mock-interview:model-api-key";
const MODEL_REMEMBER_KEY = "ai-mock-interview:remember-api-key";
const PROGRESS_KEY = "ai-mock-interview:progress";
const ANALYTICS_KEY = "ai-mock-interview:analytics";
const TRANSIENT_SESSION_KEY = "ai-mock-interview:latest-session";
const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
const ROLE_KEYS = ["ai_pm", "pm", "agent_dev", "llm_dev"] as const;

function safeSetItem(storage: Storage, key: string, value: string): boolean {
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function isQuestion(value: unknown): value is Question {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<Question>;
  return (
    typeof candidate.id === "number" &&
    Number.isFinite(candidate.id) &&
    typeof candidate.question === "string" &&
    candidate.question.trim().length > 0 &&
    candidate.question.length <= 2000 &&
    typeof candidate.category === "string" &&
    candidate.category.length <= 200 &&
    typeof candidate.answer === "string" &&
    candidate.answer.length <= 10000
  );
}

function isInterviewConfig(value: unknown): value is InterviewConfig {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<InterviewConfig>;
  return (
    typeof candidate.role === "string" &&
    ROLE_KEYS.includes(candidate.role as (typeof ROLE_KEYS)[number]) &&
    typeof candidate.questionCount === "number" &&
    Number.isInteger(candidate.questionCount) &&
    candidate.questionCount >= 1 &&
    candidate.questionCount <= 10 &&
    Array.isArray(candidate.questions) &&
    candidate.questions.length >= 1 &&
    candidate.questions.length <= 10 &&
    candidate.questions.every(isQuestion) &&
    new Set(candidate.questions.map((question) => question.id)).size ===
      candidate.questions.length &&
    typeof candidate.startedAt === "string" &&
    Number.isFinite(Date.parse(candidate.startedAt))
  );
}

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
      apiKey:
        window.sessionStorage.getItem(MODEL_API_KEY)?.trim() ||
        (window.localStorage.getItem(MODEL_REMEMBER_KEY) === "true"
          ? window.localStorage.getItem(MODEL_API_KEY)?.trim()
          : "") ||
        "",
    };
  } catch {
    return null;
  }
}

export function saveModelConfig(
  config: ModelConfig,
  options?: { rememberApiKey?: boolean },
): void {
  if (!isBrowser()) return;
  safeSetItem(
    window.localStorage,
    MODEL_CONFIG_KEY,
    JSON.stringify({ ...config, apiKey: "" }),
  );
  safeSetItem(window.sessionStorage, MODEL_API_KEY, config.apiKey);

  if (options?.rememberApiKey && config.apiKey) {
    safeSetItem(window.localStorage, MODEL_API_KEY, config.apiKey);
    safeSetItem(window.localStorage, MODEL_REMEMBER_KEY, "true");
  } else {
    window.localStorage.removeItem(MODEL_API_KEY);
    window.localStorage.removeItem(MODEL_REMEMBER_KEY);
  }
}

export function isApiKeyRemembered(): boolean {
  return (
    isBrowser() && window.localStorage.getItem(MODEL_REMEMBER_KEY) === "true"
  );
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
    return Array.isArray(parsed) ? parsed.filter(isQuestion).slice(0, 500) : [];
  } catch {
    return [];
  }
}

export function saveBookmark(question: Question): void {
  if (!isBrowser()) return;

  const bookmarks = loadBookmarks().filter((item) => item.id !== question.id);
  bookmarks.unshift(question);
  safeSetItem(window.localStorage, BOOKMARK_KEY, JSON.stringify(bookmarks.slice(0, 500)));
}

export function removeBookmark(questionId: number): void {
  if (!isBrowser()) return;

  const bookmarks = loadBookmarks().filter((item) => item.id !== questionId);
  safeSetItem(window.localStorage, BOOKMARK_KEY, JSON.stringify(bookmarks));
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
    return Array.isArray(parsed)
      ? parsed
          .filter(
            (item): item is CustomQuestion =>
              isQuestion(item) &&
              typeof (item as Partial<CustomQuestion>).role === "string" &&
              ROLE_KEYS.includes(
                (item as CustomQuestion).role as (typeof ROLE_KEYS)[number],
              ),
          )
          .slice(0, 500)
      : [];
  } catch {
    return [];
  }
}

export function saveCustomQuestions(questions: CustomQuestion[]): boolean {
  if (!isBrowser()) return false;
  return safeSetItem(
    window.localStorage,
    CUSTOM_QUESTION_KEY,
    JSON.stringify(questions.filter(isQuestion).slice(0, 500)),
  );
}

export function addCustomQuestion(question: CustomQuestion): boolean {
  const questions = loadCustomQuestions().filter((item) => item.id !== question.id);
  questions.unshift(question);
  return saveCustomQuestions(questions);
}

export function updateCustomQuestion(question: CustomQuestion): boolean {
  const questions = loadCustomQuestions().map((item) =>
    item.id === question.id ? question : item,
  );
  return saveCustomQuestions(questions);
}

export function deleteCustomQuestion(questionId: number): boolean {
  const questions = loadCustomQuestions().filter((item) => item.id !== questionId);
  return saveCustomQuestions(questions);
}

export function loadSessions(): InterviewSession[] {
  if (!isBrowser()) return [];

  let stored: InterviewSession[] = [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    stored = Array.isArray(parsed) ? (parsed as InterviewSession[]) : [];
  } catch {
    stored = [];
  }

  try {
    const transientRaw = window.sessionStorage.getItem(TRANSIENT_SESSION_KEY);
    const transient = transientRaw
      ? (JSON.parse(transientRaw) as InterviewSession)
      : null;
    return transient && isInterviewSession(transient)
      ? [transient, ...stored.filter((session) => session.id !== transient.id)]
      : stored;
  } catch {
    return stored;
  }
}

export function saveSession(session: InterviewSession): boolean {
  if (!isBrowser()) return false;

  const sessions = loadSessions().filter((item) => item.id !== session.id);
  sessions.unshift(session);
  const transientSaved = safeSetItem(
    window.sessionStorage,
    TRANSIENT_SESSION_KEY,
    JSON.stringify(session),
  );
  for (let count = Math.min(20, sessions.length); count >= 1; count -= 1) {
    if (
      safeSetItem(
        window.localStorage,
        STORAGE_KEY,
        JSON.stringify(sessions.slice(0, count)),
      )
    ) {
      return true;
    }
  }
  return transientSaved;
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
    Number.isFinite(Date.parse(candidate.createdAt)) &&
    typeof candidate.role === "string" &&
    ROLE_KEYS.includes(candidate.role as (typeof ROLE_KEYS)[number]) &&
    typeof candidate.questionCount === "number" &&
    Number.isInteger(candidate.questionCount) &&
    candidate.questionCount >= 1 &&
    candidate.questionCount <= 10 &&
    Array.isArray(candidate.questions) &&
    candidate.questions.length <= 10 &&
    candidate.questions.every(isQuestion) &&
    Array.isArray(candidate.conversation) &&
    candidate.conversation.length <= 80 &&
    candidate.conversation.every(
      (message) =>
        Boolean(message) &&
        typeof message === "object" &&
        ((message as { role?: unknown }).role === "assistant" ||
          (message as { role?: unknown }).role === "user") &&
        typeof (message as { content?: unknown }).content === "string" &&
        ((message as { content: string }).content.length <= 8000),
    ) &&
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
  safeSetItem(window.localStorage, STORAGE_KEY, JSON.stringify(sessions.slice(0, 20)));
  try {
    const transientRaw = window.sessionStorage.getItem(TRANSIENT_SESSION_KEY);
    const transient = transientRaw
      ? (JSON.parse(transientRaw) as InterviewSession)
      : null;
    if (transient?.id === id) {
      window.sessionStorage.removeItem(TRANSIENT_SESSION_KEY);
    }
  } catch {
    window.sessionStorage.removeItem(TRANSIENT_SESSION_KEY);
  }
}

export function saveInterviewConfig(config: InterviewConfig): void {
  if (!isBrowser()) return;
  const value = JSON.stringify(config);
  const recoverableValue = JSON.stringify({
    ...config,
    resume: undefined,
    modelConfig: config.modelConfig
      ? { ...config.modelConfig, apiKey: "" }
      : undefined,
  });
  try {
    window.localStorage.setItem(CONFIG_KEY, recoverableValue);
  } catch {
    // Ignore local storage errors and keep the session-only fallback below.
  }
  safeSetItem(window.sessionStorage, CONFIG_KEY, value);
}

export function loadInterviewConfig(): InterviewConfig | null {
  if (!isBrowser()) return null;

  const read = (storage: Storage | null): InterviewConfig | null => {
    if (!storage) return null;
    try {
      const raw = storage.getItem(CONFIG_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as unknown;
      return isInterviewConfig(parsed) ? parsed : null;
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

export function saveInterviewProgress(progress: InterviewProgress): void {
  if (!isBrowser()) return;
  const recoverable: InterviewProgress = {
    ...progress,
    config: {
      ...progress.config,
      resume: undefined,
      modelConfig: progress.config.modelConfig
        ? { ...progress.config.modelConfig, apiKey: "" }
        : undefined,
    },
  };
  try {
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(recoverable));
    window.sessionStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    // Storage can be unavailable or full; the current in-memory interview continues.
  }
}

export function loadInterviewProgress(): InterviewProgress | null {
  if (!isBrowser()) return null;
  for (const storage of [window.sessionStorage, window.localStorage]) {
    try {
      const raw = storage.getItem(PROGRESS_KEY);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as InterviewProgress;
      if (
        isInterviewConfig(parsed?.config) &&
        Array.isArray(parsed.conversation) &&
        parsed.conversation.length <= 80 &&
        parsed.conversation.every(
          (message) =>
            (message?.role === "assistant" || message?.role === "user") &&
            typeof message.content === "string" &&
            message.content.length <= 8000,
        ) &&
        Number.isInteger(parsed.currentIndex) &&
        parsed.currentIndex >= 0 &&
        parsed.currentIndex < parsed.config.questions.length &&
        Number.isInteger(parsed.followUpCount) &&
        parsed.followUpCount >= 0 &&
        parsed.followUpCount <= 2
      ) {
        return {
          ...parsed,
          draft: parsed.draft ?? "",
          inputMode: parsed.inputMode ?? "voice",
          answeredIds: Array.isArray(parsed.answeredIds) ? parsed.answeredIds : [],
          attempts: Array.isArray(parsed.attempts) ? parsed.attempts : [],
        };
      }
    } catch {
      // Try the next storage tier.
    }
  }
  return null;
}

export function clearInterviewProgress(): void {
  if (!isBrowser()) return;
  window.sessionStorage.removeItem(PROGRESS_KEY);
  window.localStorage.removeItem(PROGRESS_KEY);
}

export function clearAllLocalData(): void {
  if (!isBrowser()) return;
  [
    STORAGE_KEY,
    CONFIG_KEY,
    BOOKMARK_KEY,
    CUSTOM_QUESTION_KEY,
    MODEL_CONFIG_KEY,
    MODEL_API_KEY,
    MODEL_REMEMBER_KEY,
    PROGRESS_KEY,
    ANALYTICS_KEY,
    TRANSIENT_SESSION_KEY,
    "ai-mock-interview:anonymous-id",
    "ai-mock-interview:visit-id",
    "ai-mock-interview:attribution",
    "ai-mock-interview:first-answer-sent",
    "ai-mock-interview:landing-view-sent",
  ].forEach((key) => {
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  });
}

export function exportLocalData(): string {
  if (!isBrowser()) return "{}";
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    sessions: getValidSessions(),
    bookmarks: loadBookmarks(),
    customQuestions: loadCustomQuestions(),
  };
  return JSON.stringify(payload, null, 2);
}

export function importLocalData(raw: string): {
  sessions: number;
  bookmarks: number;
  customQuestions: number;
} {
  if (!isBrowser()) throw new Error("当前环境无法导入数据。");
  if (new TextEncoder().encode(raw).byteLength > MAX_IMPORT_BYTES) {
    throw new Error("备份文件过大，最多支持 5 MB。");
  }
  const payload = JSON.parse(raw) as {
    sessions?: unknown[];
    bookmarks?: unknown[];
    customQuestions?: unknown[];
  };
  if (!payload || typeof payload !== "object") {
    throw new Error("备份文件格式不正确。");
  }

  const sessions = Array.isArray(payload.sessions)
    ? payload.sessions.filter(isInterviewSession).slice(0, 20)
    : [];
  const bookmarks = Array.isArray(payload.bookmarks)
    ? payload.bookmarks.filter(isQuestion).slice(0, 500)
    : [];
  const customQuestions = Array.isArray(payload.customQuestions)
    ? payload.customQuestions.filter(
        (item): item is CustomQuestion =>
          isQuestion(item) &&
          typeof (item as CustomQuestion).role === "string" &&
          ROLE_KEYS.includes(
            (item as CustomQuestion).role as (typeof ROLE_KEYS)[number],
          ),
      ).slice(0, 500)
    : [];

  const writes = [
    safeSetItem(window.localStorage, STORAGE_KEY, JSON.stringify(sessions)),
    safeSetItem(window.localStorage, BOOKMARK_KEY, JSON.stringify(bookmarks)),
    safeSetItem(
      window.localStorage,
      CUSTOM_QUESTION_KEY,
      JSON.stringify(customQuestions),
    ),
  ];
  if (writes.some((written) => !written)) {
    throw new Error("本机存储空间不足，无法完成导入。");
  }

  return {
    sessions: sessions.length,
    bookmarks: bookmarks.length,
    customQuestions: customQuestions.length,
  };
}
