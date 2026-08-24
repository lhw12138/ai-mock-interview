import { z } from "zod";

export const interviewTurnSchema = z.object({
  action: z.enum(["follow_up", "next_question"]),
  response: z.string().min(1, "回复内容不能为空"),
  assessment: z.string().default(""),
});

export const dimensionScoreSchema = z.object({
  score: z.number().min(0).max(100),
  comment: z.string(),
  evidence: z.string().default(""),
  confidence: z.enum(["low", "medium", "high"]).default("medium"),
});

export const dimensionScoresSchema = z.record(
  z.string(),
  dimensionScoreSchema,
);

export const perQuestionReviewSchema = z.object({
  questionId: z.number().optional(),
  answerSummary: z.string(),
  strengths: z.string(),
  weaknesses: z.string(),
  evidence: z.string().default(""),
  improvedAnswer: z.string().default(""),
  score: z.number().min(0).max(100).default(0),
  confidence: z.enum(["low", "medium", "high"]).default("medium"),
});

export const reportSchema = z.object({
  dimensionScores: dimensionScoresSchema,
  perQuestion: z.array(perQuestionReviewSchema),
  overallFeedback: z.string(),
  improvementSuggestions: z.array(z.string()).length(3),
  scoreBand: z.string().default("待提升"),
  weeklyGoals: z.array(z.string()).min(1).max(2).default([]),
});
