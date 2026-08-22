export type RoleKey =
  | "ai_pm"
  | "pm"
  | "growth_pm"
  | "data_pm"
  | "b2b_pm"
  | "user_pm";

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

export interface InterviewRequest {
  role: RoleKey;
  questions: Question[];
  currentIndex: number;
  totalQuestions: number;
  followUpCount: number;
  conversation: ChatMessage[];
  currentAnswer: string;
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
}

export interface DimensionScores {
  logic: DimensionScore;
  productSense: DimensionScore;
  communication: DimensionScore;
  aiUnderstanding: DimensionScore;
  adaptability: DimensionScore;
}

export interface PerQuestionReview {
  questionId: number;
  question: string;
  answerSummary: string;
  strengths: string;
  weaknesses: string;
  referenceAnswer: string;
}

export interface InterviewReport {
  totalScore: number;
  dimensionScores: DimensionScores;
  perQuestion: PerQuestionReview[];
  overallFeedback: string;
  improvementSuggestions: string[];
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
}

export interface InterviewConfig {
  role: RoleKey;
  questionCount: number;
  questions: Question[];
  startedAt: string;
}
