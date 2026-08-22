import { streamObject } from "ai";
import { z } from "zod";
import { getDeepSeekModel } from "@/lib/ai";
import { buildInterviewPrompt } from "@/lib/prompts";
import { interviewTurnSchema } from "@/lib/schemas";

export const runtime = "nodejs";
export const maxDuration = 60;

const questionSchema = z.object({
  id: z.number(),
  question: z.string(),
  category: z.string(),
  answer: z.string(),
});

const requestSchema = z.object({
  role: z.enum(["ai_pm", "pm"]),
  questions: z.array(questionSchema).min(1),
  currentIndex: z.number().int().min(0),
  totalQuestions: z.number().int().min(1),
  followUpCount: z.number().int().min(0),
  conversation: z.array(
    z.object({
      role: z.enum(["assistant", "user"]),
      content: z.string(),
    }),
  ),
  currentAnswer: z.string().min(1),
});

function errorResponse(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(request: Request) {
  let body;

  try {
    body = requestSchema.parse(await request.json());
  } catch {
    return errorResponse("面试请求参数不正确，请刷新页面后重试。", 400);
  }

  try {
    const model = getDeepSeekModel();
    const prompt = buildInterviewPrompt(body);

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
    const message = error instanceof Error ? error.message : "面试官暂时无法响应。";
    return errorResponse(message, 500);
  }
}
