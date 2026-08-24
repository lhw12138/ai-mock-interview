import { generateObject } from "ai";
import { z } from "zod";
import { getDeepSeekModel } from "@/lib/ai";
import {
  assertSafeModelBaseUrl,
  enforceJsonRequest,
  enforceRateLimit,
  getPublicAiError,
  readJsonBody,
  RequestBodyTooLargeError,
} from "@/lib/api-security";

export const runtime = "nodejs";
export const maxDuration = 30;

const requestSchema = z.object({
  modelConfig: z.object({
    baseUrl: z.string().min(1).max(2048),
    model: z.string().min(1).max(200),
    apiKey: z.string().max(512).optional(),
  }),
});

export async function POST(request: Request) {
  const invalidRequest = enforceJsonRequest(request);
  if (invalidRequest) return invalidRequest;

  const rateLimited = enforceRateLimit(request, {
    bucket: "model-test",
    limit: 10,
    windowMs: 10 * 60 * 1000,
  });
  if (rateLimited) return rateLimited;

  let body;

  try {
    body = requestSchema.parse(await readJsonBody(request, 8 * 1024));
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return Response.json({ ok: false, error: "模型配置内容过长。" }, { status: 413 });
    }
    return Response.json({ ok: false, error: "参数不正确。" }, { status: 400 });
  }

  try {
    await assertSafeModelBaseUrl(body.modelConfig.baseUrl);
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
    const rawMessage = getPublicAiError(
      error,
      "连接失败，请检查服务商配置后重试。",
    );
    const message = /could not parse|No object generated/i.test(rawMessage)
      ? "模型返回内容无法解析：可能是该模型不支持 JSON 输出，或回答被截断，请换用其他模型。"
      : rawMessage;
    return Response.json({ ok: false, error: message });
  }
}
