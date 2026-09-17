export const ROLE_KEYS = [
  "ai_pm",
  "pm",
  "agent_dev",
  "llm_dev",
  "frontend",
  "java_backend",
  "data_analyst",
  "operations",
  "custom",
] as const;

export type RoleKey = (typeof ROLE_KEYS)[number];

export function isRoleKey(value: unknown): value is RoleKey {
  return typeof value === "string" && ROLE_KEYS.some((role) => role === value);
}
export type InterviewMode = "practice" | "simulation";

export interface Question {
  id: number;
  question: string;
  category: string;
  answer: string;
}

export interface CustomQuestion extends Question {
  role: RoleKey;
}

export type ChatRole = "assistant" | "user";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface AnswerAttempt {
  questionId: number;
  question: string;
  answers: string[];
  inputTypes: Array<"voice" | "text">;
  durationMs: number;
  skipped?: boolean;
}

export interface InterviewRequest {
  role: RoleKey;
  modelConfig?: ModelConfig;
  questions: Question[];
  currentIndex: number;
  totalQuestions: number;
  followUpCount: number;
  conversation: ChatMessage[];
  currentAnswer: string;
  mode?: InterviewMode;
  seniority?: InterviewConfig["seniority"];
  interviewRound?: InterviewConfig["interviewRound"];
  jobDescription?: string;
  resume?: string;
  practiceGoal?: string;
  customInterviewTitle?: string;
  customInterviewContext?: string;
}

export type InterviewAction = "follow_up" | "next_question";

export interface InterviewTurn {
  action: InterviewAction;
  response: string;
  assessment: string;
}

export interface DimensionScore {
  score: number;
  comment: string;
  evidence?: string;
  confidence?: "low" | "medium" | "high";
}

export type DimensionScores = Record<string, DimensionScore>;

export interface PerQuestionReview {
  questionId: number;
  question: string;
  answerSummary: string;
  strengths: string;
  weaknesses: string;
  referenceAnswer: string;
  userAnswer?: string;
  evidence?: string;
  improvedAnswer?: string;
  score?: number;
  confidence?: "low" | "medium" | "high";
}

export interface InterviewReport {
  totalScore: number;
  dimensionScores: DimensionScores;
  perQuestion: PerQuestionReview[];
  overallFeedback: string;
  improvementSuggestions: string[];
  scoreBand?: string;
  rubricVersion?: string;
  disclaimer?: string;
  weeklyGoals?: string[];
  weakestDimension?: string;
}

export interface InterviewSession {
  id: string;
  createdAt: string;
  role: RoleKey;
  questionCount: number;
  questions: Question[];
  conversation: ChatMessage[];
  report: InterviewReport;
  durationMs: number;
  answeredCount?: number;
  status?: "completed" | "ended_early";
  attempts?: AnswerAttempt[];
  sourceSessionId?: string;
  customInterviewTitle?: string;
}

export interface InterviewConfig {
  role: RoleKey;
  questionCount: number;
  questions: Question[];
  startedAt: string;
  resume?: string;
  modelConfig?: ModelConfig;
  mode?: InterviewMode;
  seniority?: "junior" | "mid" | "senior";
  interviewRound?: "screening" | "professional" | "final";
  jobDescription?: string;
  practiceGoal?: string;
  sourceSessionId?: string;
  baselineAnswers?: Record<number, string>;
  customInterviewTitle?: string;
  customInterviewContext?: string;
}

export interface ModelConfig {
  baseUrl: string;
  model: string;
  apiKey: string;
}

export interface InterviewProgress {
  config: InterviewConfig;
  currentIndex: number;
  followUpCount: number;
  conversation: ChatMessage[];
  draft: string;
  inputMode: "voice" | "text";
  answeredIds: number[];
  attempts: AnswerAttempt[];
  updatedAt: string;
}
