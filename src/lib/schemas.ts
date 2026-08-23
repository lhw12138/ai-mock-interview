import { z } from "zod";

export const interviewTurnSchema = z.object({
  action: z.enum(["follow_up", "next_question"]),
  response: z.string().min(1, "回复内容不能为空"),
  assessment: z.string().default(""),
});

export const dimensionScoreSchema = z.object({
  score: z.number().min(0).max(100),
  comment: z.string(),
});

export const dimensionScoresSchema = z.record(
  z.string(),
  dimensionScoreSchema,
);

export const perQuestionReviewSchema = z.object({
  answerSummary: z.string(),
  strengths: z.string(),
  weaknesses: z.string(),
});

export const reportSchema = z.object({
  dimensionScores: dimensionScoresSchema,
  perQuestion: z.array(perQuestionReviewSchema),
  overallFeedback: z.string(),
  improvementSuggestions: z.array(z.string()).length(3),
});
