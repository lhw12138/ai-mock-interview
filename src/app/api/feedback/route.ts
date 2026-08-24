import {
  enforceJsonRequest,
  enforceRateLimit,
  readJsonBody,
  RequestBodyTooLargeError,
} from "../../../lib/api-security";
import {
  feedbackSchema,
  formatFeishuFeedback,
  isAllowedFeishuWebhook,
} from "../../../lib/feedback";

export const runtime = "nodejs";
export const maxDuration = 15;

export async function POST(request: Request) {
  const invalidRequest = enforceJsonRequest(request);
  if (invalidRequest) return invalidRequest;

  const rateLimited = enforceRateLimit(request, {
    bucket: "feedback",
    limit: 5,
    windowMs: 10 * 60 * 1000,
  });
  if (rateLimited) return rateLimited;

  let feedback;
  try {
    feedback = feedbackSchema.parse(await readJsonBody(request, 8 * 1024));
  } catch (error) {
    const message =
      error instanceof RequestBodyTooLargeError
        ? "反馈内容过长，请精简后重试。"
        : "请检查反馈类型、满意度和反馈内容。";
    return Response.json(
      { ok: false, error: message },
      { status: error instanceof RequestBodyTooLargeError ? 413 : 400 },
    );
  }

  const webhook = process.env.FEISHU_FEEDBACK_WEBHOOK_URL?.trim();
  if (!webhook || !isAllowedFeishuWebhook(webhook)) {
    console.error("Feedback webhook is missing or invalid.");
    return Response.json(
      { ok: false, error: "反馈通道暂未配置，请稍后再试。" },
      { status: 503 },
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        msg_type: "text",
        content: {
          text: formatFeishuFeedback(feedback, {
            userAgent: request.headers.get("user-agent") ?? "未知",
            receivedAt: new Intl.DateTimeFormat("zh-CN", {
              dateStyle: "medium",
              timeStyle: "medium",
              timeZone: "Asia/Shanghai",
            }).format(new Date()),
          }),
        },
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    const result = (await response.json().catch(() => null)) as
      | { code?: number; StatusCode?: number }
      | null;
    const feishuOk = result?.code === 0 || result?.StatusCode === 0;
    if (!response.ok || !feishuOk) {
      throw new Error("FEISHU_REJECTED");
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error(
      "Feedback delivery failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return Response.json(
      { ok: false, error: "反馈暂时发送失败，请稍后重试。" },
      { status: 502 },
    );
  } finally {
    clearTimeout(timeout);
  }
}
