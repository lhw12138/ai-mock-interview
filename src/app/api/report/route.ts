import { generateObject } from "ai";
import { z } from "zod";
import { getDeepSeekModel } from "@/lib/ai";
import { buildReportPrompt } from "@/lib/prompts";
import { reportSchema } from "@/lib/schemas";
import { calculateTotalScore } from "@/lib/score";
import type { PerQuestionReview } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

const questionSchema = z.object({
  id: z.number(),
  question: z.string(),
  category: z.string(),
  answer: z.string(),
});

const requestSchema = z.object({
  role: z.enum(["ai_pm", "pm"]),
  questions: z.array(questionSchema).min(1),
  conversation: z.array(
    z.object({
      role: z.enum(["assistant", "user"]),
      content: z.string(),
    }),
  ),
  answeredCount: z.number().int().min(1).optional(),
  totalQuestions: z.number().int().min(1).optional(),
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
    return errorResponse("报告请求参数不正确。", 400);
  }

  try {
    const model = getDeepSeekModel();
    const prompt = buildReportPrompt(body);

    const result = await generateObject({
      model,
      schema: reportSchema,
      mode: "json",
      system: prompt.system,
      prompt: prompt.prompt,
      temperature: 0.2,
      maxTokens: 2500,
    });

    const perQuestion: PerQuestionReview[] = body.questions.map((question, index) => {
      const review = result.object.perQuestion[index] ?? {
        answerSummary: "",
        strengths: "",
        weaknesses: "",
      };

      return {
        questionId: question.id,
        question: question.question,
        answerSummary: review.answerSummary,
        strengths: review.strengths,
        weaknesses: review.weaknesses,
        referenceAnswer: question.answer,
      };
    });

    const report = {
      totalScore: calculateTotalScore(result.object.dimensionScores),
      dimensionScores: result.object.dimensionScores,
      perQuestion,
      overallFeedback: result.object.overallFeedback,
      improvementSuggestions: result.object.improvementSuggestions,
    };

    return Response.json(report);
  } catch (error) {
    const message = error instanceof Error ? error.message : "评分报告生成失败。";
    return errorResponse(message, 502);
  }
}
