import { streamObject } from "ai";
import { z } from "zod";
import { getDeepSeekModel } from "@/lib/ai";
import { buildInterviewPrompt } from "@/lib/prompts";
import { interviewTurnSchema } from "@/lib/schemas";
import { ROLE_KEYS } from "@/lib/types";
import {
  assertSafeModelBaseUrl,
  enforceJsonRequest,
  enforceRateLimit,
  getPublicAiError,
  readJsonBody,
  RequestBodyTooLargeError,
} from "@/lib/api-security";

export const runtime = "nodejs";
export const maxDuration = 60;

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
  currentIndex: z.number().int().min(0),
  totalQuestions: z.number().int().min(1),
  followUpCount: z.number().int().min(0).max(2),
  conversation: z.array(
    z.object({
      role: z.enum(["assistant", "user"]),
      content: z.string().max(8000),
    }),
  ).max(80),
  currentAnswer: z.string().trim().min(1).max(8000),
  mode: z.enum(["practice", "simulation"]).optional(),
  seniority: z.enum(["junior", "mid", "senior"]).optional(),
  interviewRound: z
    .enum(["screening", "professional", "final"])
    .optional(),
  jobDescription: z.string().max(12000).optional(),
  resume: z.string().max(30000).optional(),
  practiceGoal: z.string().max(100).optional(),
  customInterviewTitle: z.string().trim().max(80).optional(),
  customInterviewContext: z.string().trim().max(4000).optional(),
}).superRefine((value, context) => {
  if (value.role === "custom" && !value.customInterviewTitle) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["customInterviewTitle"], message: "缺少自定义面试名称" });
  }
  if (value.currentIndex >= value.questions.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["currentIndex"],
      message: "当前题号超出题目范围",
    });
  }
  if (value.totalQuestions !== value.questions.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["totalQuestions"],
      message: "题目总数不一致",
    });
  }
  if (new Set(value.questions.map((question) => question.id)).size !== value.questions.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["questions"],
      message: "题目 ID 不能重复",
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
    bucket: "interview",
    limit: 30,
    windowMs: 10 * 60 * 1000,
  });
  if (rateLimited) return rateLimited;

  let body;

  try {
    body = requestSchema.parse(await readJsonBody(request, 2 * 1024 * 1024));
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return errorResponse("面试内容过长，请缩短回答后重试。", 413);
    }
    return errorResponse("面试请求参数不正确，请刷新页面后重试。", 400);
  }

  try {
    const modelConfig = body.modelConfig
      ? {
          baseUrl: body.modelConfig.baseUrl ?? "",
          model: body.modelConfig.model ?? "",
          apiKey: body.modelConfig.apiKey ?? "",
        }
      : undefined;
    await assertSafeModelBaseUrl(modelConfig?.baseUrl);
    const model = getDeepSeekModel(modelConfig);
    const prompt = buildInterviewPrompt({ ...body, modelConfig });

    const result = streamObject({
      model,
      schema: interviewTurnSchema,
      mode: "json",
      system: prompt.system,
      prompt: prompt.prompt,
      temperature: 0.3,
      maxTokens: 500,
    });

    return result.toTextStreamResponse();
  } catch (error) {
    const message = getPublicAiError(
      error,
      "面试官暂时无法响应，请稍后重试。",
    );
    return errorResponse(message, 500);
  }
}
