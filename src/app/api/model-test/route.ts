import { generateObject } from "ai";
import { z } from "zod";
import { getDeepSeekModel } from "@/lib/ai";

export const runtime = "nodejs";
export const maxDuration = 30;

const requestSchema = z.object({
  modelConfig: z.object({
    baseUrl: z.string().min(1),
    model: z.string().min(1),
    apiKey: z.string().optional(),
  }),
});

export async function POST(request: Request) {
  let body;

  try {
    body = requestSchema.parse(await request.json());
  } catch {
    return Response.json({ ok: false, error: "参数不正确。" }, { status: 400 });
  }

  try {
    const model = getDeepSeekModel(body.modelConfig);
    await generateObject({
      model,
      schema: z.object({ ok: z.boolean() }),
      mode: "json",
      system: "你只负责校验接口连通性，不要输出任何多余内容。",
      prompt: '请只返回 JSON：{"ok":true}',
      temperature: 0,
      maxTokens: 400,
    });
    return Response.json({ ok: true });
  } catch (error) {
    const rawMessage =
      error instanceof Error ? error.message : "连接失败。";
    const message = /could not parse|No object generated/i.test(rawMessage)
      ? "模型返回内容无法解析：可能是该模型不支持 JSON 输出，或回答被截断，请换用其他模型。"
      : rawMessage;
    return Response.json({ ok: false, error: message });
  }
}
