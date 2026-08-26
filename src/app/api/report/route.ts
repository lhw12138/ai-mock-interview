import { generateObject } from "ai";
import { z } from "zod";
import { getDeepSeekModel } from "@/lib/ai";
import { buildReportPrompt } from "@/lib/prompts";
import { reportSchema } from "@/lib/schemas";
import { calculateTotalScore, getDimensionDefs } from "@/lib/score";
import { ROLE_KEYS, type PerQuestionReview } from "@/lib/types";
import {
  assertSafeModelBaseUrl,
  enforceJsonRequest,
  enforceRateLimit,
  getPublicAiError,
  readJsonBody,
  RequestBodyTooLargeError,
} from "@/lib/api-security";

export const runtime = "nodejs";
export const maxDuration = 120;

const questionSchema = z.object({
  id: z.number(),
  question: z.string().min(1).max(2000),
  category: z.string().max(200),
  answer: z.string().max(10000),
});

const modelConfigSchema = z
  .object({
    baseUrl: z.string().max(2048).optional(),
    model: z.string().max(200).optional(),
    apiKey: z.string().max(512).optional(),
  })
  .optional();

const requestSchema = z.object({
  role: z.enum(ROLE_KEYS),
  modelConfig: modelConfigSchema,
  questions: z.array(questionSchema).min(1).max(10),
  conversation: z.array(
    z.object({
      role: z.enum(["assistant", "user"]),
      content: z.string().max(8000),
    }),
  ).max(80),
  answeredCount: z.number().int().min(1).max(10).optional(),
  totalQuestions: z.number().int().min(1).max(10).optional(),
  attempts: z
    .array(
      z.object({
        questionId: z.number(),
        question: z.string().max(2000),
        answers: z.array(z.string().trim().min(1).max(8000)).min(1).max(3),
        inputTypes: z.array(z.enum(["voice", "text"])).min(1).max(3),
        durationMs: z.number().min(0).max(24 * 60 * 60 * 1000),
        skipped: z.boolean().optional(),
      }).refine((attempt) => attempt.answers.length === attempt.inputTypes.length, {
        message: "回答与输入方式数量不一致",
      }),
    ).max(10)
    .optional(),
  baselineAnswers: z
    .record(z.string().max(8000))
    .refine((value) => Object.keys(value).length <= 10, "基线回答数量过多")
    .optional(),
  mode: z.enum(["practice", "simulation"]).optional(),
  seniority: z.enum(["junior", "mid", "senior"]).optional(),
  interviewRound: z
    .enum(["screening", "professional", "final"])
    .optional(),
  jobDescription: z.string().max(12000).optional(),
  practiceGoal: z.string().max(100).optional(),
}).superRefine((value, context) => {
  const questionIds = new Set(value.questions.map((question) => question.id));
  if (questionIds.size !== value.questions.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["questions"],
      message: "题目 ID 不能重复",
    });
  }
  if (value.totalQuestions !== undefined && value.totalQuestions < value.questions.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["totalQuestions"],
      message: "题目总数不能小于已作答题数",
    });
  }
  const attemptIds = value.attempts?.map((attempt) => attempt.questionId) ?? [];
  if (new Set(attemptIds).size !== attemptIds.length || attemptIds.some((id) => !questionIds.has(id))) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["attempts"],
      message: "作答记录与题目不匹配",
    });
  }
});

function errorResponse(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(request: Request) {
  const invalidRequest = enforceJsonRequest(request);
  if (invalidRequest) return invalidRequest;

  const rateLimited = enforceRateLimit(request, {
    bucket: "report",
    limit: 12,
    windowMs: 10 * 60 * 1000,
  });
  if (rateLimited) return rateLimited;

  let body;

  try {
    body = requestSchema.parse(await readJsonBody(request, 4 * 1024 * 1024));
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return errorResponse("本场面试内容过长，请减少回答长度后重试。", 413);
    }
    return errorResponse("报告请求参数不正确。", 400);
  }

  try {
    await assertSafeModelBaseUrl(body.modelConfig?.baseUrl);
    const model = getDeepSeekModel(body.modelConfig);
    const prompt = buildReportPrompt(body);

    const result = await generateObject({
      model,
      schema: reportSchema,
      mode: "json",
      system: prompt.system,
      prompt: prompt.prompt,
      temperature: 0.2,
      maxTokens: 4500,
    });

    const dimensionScores = { ...result.object.dimensionScores };
    for (const definition of getDimensionDefs(body.role)) {
      if (!dimensionScores[definition.key]) {
        dimensionScores[definition.key] = {
          score: 0,
          comment: "该维度未能完成评分",
          evidence: "本场回答不足以形成该维度判断。",
          confidence: "low",
        };
      }
    }

    const perQuestion: PerQuestionReview[] = body.questions.map((question, index) => {
      const review =
        result.object.perQuestion.find(
          (candidate) => candidate.questionId === question.id,
        ) ??
        result.object.perQuestion[index] ?? {
        answerSummary: "",
        strengths: "",
        weaknesses: "",
        evidence: "",
        improvedAnswer: "",
        score: 0,
        confidence: "low" as const,
      };
      const attempt = body.attempts?.find(
        (item) => item.questionId === question.id,
      );

      return {
        questionId: question.id,
        question: question.question,
        answerSummary: review.answerSummary,
        strengths: review.strengths,
        weaknesses: review.weaknesses,
        referenceAnswer: question.answer,
        userAnswer: attempt?.answers.join("\n\n补充回答：") ?? "",
        evidence: review.evidence,
        improvedAnswer: review.improvedAnswer,
        score: review.score,
        confidence: review.confidence,
      };
    });

    const weakestDimension = getDimensionDefs(body.role).reduce(
      (weakest, definition) => {
        const score = dimensionScores[definition.key]?.score ?? 0;
        const weakestScore = dimensionScores[weakest.key]?.score ?? 0;
        return score < weakestScore ? definition : weakest;
      },
      getDimensionDefs(body.role)[0],
    );

    const report = {
      totalScore: calculateTotalScore(dimensionScores, body.role),
      dimensionScores,
      perQuestion,
      overallFeedback: result.object.overallFeedback,
      improvementSuggestions: result.object.improvementSuggestions,
      scoreBand: result.object.scoreBand,
      weeklyGoals: result.object.weeklyGoals,
      rubricVersion: "rubric-v2",
      disclaimer:
        "本报告用于模拟练习与自我复盘，由 AI 基于本场回答生成，不代表真实招聘结论。",
      weakestDimension: weakestDimension.key,
    };

    return Response.json(report);
  } catch (error) {
    const message = getPublicAiError(
      error,
      "评分报告生成失败，请保留本场记录并稍后重试。",
    );
    return errorResponse(message, 502);
  }
}
