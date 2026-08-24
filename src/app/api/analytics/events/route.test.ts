import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const validPayload = {
  eventId: "evt_test_12345678",
  eventName: "interview_start",
  anonymousId: "anon_test_12345678",
  visitId: "visit_test_12345678",
  path: "/",
  occurredAt: Date.now(),
  attribution: { source: "v2ex", campaign: "launch" },
  properties: { role: "ai_pm", questionCount: 5, mode: "practice" },
};

function createRequest(body: unknown, headers?: HeadersInit) {
  return new Request("http://localhost/api/analytics/events", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/analytics/events", () => {
  it("writes a structured anonymous event without returning its contents", async () => {
    const log = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const response = await POST(createRequest(validPayload));

    expect(response.status).toBe(202);
    expect(await response.text()).toBe("");
    expect(log).toHaveBeenCalledTimes(1);

    const stored = JSON.parse(String(log.mock.calls[0]?.[0]));
    expect(stored).toMatchObject({
      logType: "product_analytics",
      schemaVersion: 1,
      eventName: "interview_start",
      anonymousId: "anon_test_12345678",
    });
    expect(JSON.stringify(stored)).not.toContain("resume");
  });

  it("rejects unexpected sensitive fields", async () => {
    const log = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const response = await POST(
      createRequest({ ...validPayload, resume: "private resume" }),
    );

    expect(response.status).toBe(400);
    expect(log).not.toHaveBeenCalled();
  });

  it("rejects cross-site submissions", async () => {
    const response = await POST(
      createRequest(validPayload, {
        Origin: "https://attacker.example",
        "Sec-Fetch-Site": "cross-site",
      }),
    );

    expect(response.status).toBe(403);
  });
});
