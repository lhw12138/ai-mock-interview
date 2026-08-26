import { z } from "zod";
import { ROLE_KEYS } from "./types";

export const productEventNames = [
  "landing_view",
  "interview_start",
  "first_answer",
  "answer_submit",
  "follow_up_shown",
  "interview_finish",
  "report_success",
  "practice_start",
  "practice_finish",
  "feedback_submit",
  "service_error",
] as const;

const identifierSchema = z
  .string()
  .min(8)
  .max(80)
  .regex(/^[a-zA-Z0-9_-]+$/);

const attributionSchema = z
  .object({
    source: z.string().trim().min(1).max(120).optional(),
    medium: z.string().trim().min(1).max(120).optional(),
    campaign: z.string().trim().min(1).max(120).optional(),
    content: z.string().trim().min(1).max(120).optional(),
    term: z.string().trim().min(1).max(120).optional(),
    referrerHost: z.string().trim().min(1).max(253).optional(),
  })
  .strict();

const eventPropertiesSchema = z
  .object({
    role: z.enum([...ROLE_KEYS, "llm_app_dev"]).optional(),
    mode: z.enum(["practice", "simulation"]).optional(),
    questionCount: z.number().int().min(1).max(20).optional(),
    questionIndex: z.number().int().min(0).max(20).optional(),
    inputType: z.enum(["voice", "text"]).optional(),
    durationMs: z.number().int().min(0).max(24 * 60 * 60 * 1000).optional(),
    answeredCount: z.number().int().min(0).max(20).optional(),
    targeted: z.boolean().optional(),
    score: z.number().int().min(0).max(100).optional(),
    didShare: z.boolean().optional(),
    practiceGoal: z.string().trim().min(1).max(40).optional(),
    category: z.string().trim().min(1).max(40).optional(),
    rating: z.number().int().min(1).max(5).optional(),
    followUpRound: z.number().int().min(1).max(2).optional(),
    errorStage: z
      .enum(["interview_prepare", "interview_turn", "report", "model_test"])
      .optional(),
    errorCode: z
      .enum(["network", "timeout", "rate_limited", "invalid_response", "provider"])
      .optional(),
  })
  .strict();

export const productAnalyticsSchema = z
  .object({
    eventId: identifierSchema,
    eventName: z.enum(productEventNames),
    anonymousId: identifierSchema,
    visitId: identifierSchema,
    path: z
      .string()
      .min(1)
      .max(128)
      .regex(/^\/[a-zA-Z0-9/_-]*$/),
    occurredAt: z.number().int().min(0),
    attribution: attributionSchema.optional(),
    properties: eventPropertiesSchema.optional(),
  })
  .strict();

export type ProductAnalyticsPayload = z.infer<typeof productAnalyticsSchema>;
