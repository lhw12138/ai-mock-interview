import {
  enforceJsonRequest,
  enforceRateLimit,
  readJsonBody,
  RequestBodyTooLargeError,
} from "../../../../lib/api-security";
import { productAnalyticsSchema } from "../../../../lib/product-analytics";

export const runtime = "nodejs";
export const maxDuration = 5;

export async function POST(request: Request) {
  const invalidRequest = enforceJsonRequest(request);
  if (invalidRequest) return invalidRequest;

  const rateLimited = enforceRateLimit(request, {
    bucket: "product-analytics",
    limit: 120,
    windowMs: 60 * 1000,
  });
  if (rateLimited) return rateLimited;

  try {
    const event = productAnalyticsSchema.parse(
      await readJsonBody(request, 4 * 1024),
    );
    const now = Date.now();
    const occurredAt =
      Math.abs(now - event.occurredAt) <= 7 * 24 * 60 * 60 * 1000
        ? event.occurredAt
        : now;

    console.info(
      JSON.stringify({
        logType: "product_analytics",
        schemaVersion: 1,
        ...event,
        occurredAt,
        receivedAt: now,
      }),
    );

    return new Response(null, {
      status: 202,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return Response.json(
      { error: "统计事件格式不正确。" },
      { status: error instanceof RequestBodyTooLargeError ? 413 : 400 },
    );
  }
}
