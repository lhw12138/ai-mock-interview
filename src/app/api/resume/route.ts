import { generateObject } from "ai";
import { z } from "zod";
import { getDeepSeekModel } from "@/lib/ai";
import { getRoleLabel } from "@/lib/roles";

export const runtime = "nodejs";
export const maxDuration = 60;

const requestSchema = z.object({
  role: z.enum(["ai_pm", "pm", "agent_dev"]),
  resume: z.string().min(1),
  difficulty: z.enum(["basic", "intermediate", "advanced"]).default("intermediate"),
});

const outputSchema = z.object({
  questions: z.array(
    z.object({
      question: z.string(),
      answer: z.string(),
    }),
  ).length(3),
});

const DIFFICULTY_LABELS = {
  basic: "基础",
  intermediate: "进阶",
  advanced: "困难",
} as const;

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
    return errorResponse("简历提问参数不正确。", 400);
  }

  try {
    const model = getDeepSeekModel();
    const result = await generateObject({
      model,
      schema: outputSchema,
      mode: "json",
      system:
        "你是一位资深技术面试官。请根据候选人简历和目标难度，生成 3 个由浅入深、互不重复的针对性面试问题，并给出参考答案思路。只输出 JSON。",
      prompt: `目标岗位：${getRoleLabel(body.role)}
难度：${DIFFICULTY_LABELS[body.difficulty]}

候选人简历：
${body.resume}

请生成 3 个能考察候选人真实项目经验、技术判断或业务思考的问题。`,
      temperature: 0.5,
      maxTokens: 1200,
    });

    return Response.json({
      questions: result.object.questions.map((question) => ({
        question: question.question,
        category: `简历针对性 · ${DIFFICULTY_LABELS[body.difficulty]}`,
        answer: question.answer,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "简历提问生成失败。";
    return errorResponse(message, 502);
  }
}
