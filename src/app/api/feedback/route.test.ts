import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const payload = {
  category: "使用困难",
  rating: 3,
  message: "移动端提交回答时不容易找到按钮。",
  sourcePage: "/interview",
};

function createRequest(body: unknown) {
  return new Request("http://localhost/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("POST /api/feedback", () => {
  it("delivers valid feedback without exposing the webhook to the client", async () => {
    vi.stubEnv(
      "FEISHU_FEEDBACK_WEBHOOK_URL",
      "https://open.feishu.cn/open-apis/bot/v2/hook/test_webhook",
    );
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ code: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(createRequest(payload));
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(result)).not.toContain("test_webhook");
  });

  it("returns a clear error when the webhook is not configured", async () => {
    vi.stubEnv("FEISHU_FEEDBACK_WEBHOOK_URL", "");
    const response = await POST(createRequest(payload));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ ok: false });
  });

  it("rejects empty input before delivery", async () => {
    vi.stubEnv(
      "FEISHU_FEEDBACK_WEBHOOK_URL",
      "https://open.feishu.cn/open-apis/bot/v2/hook/test_webhook",
    );
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(createRequest({ ...payload, message: "   " }));
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
