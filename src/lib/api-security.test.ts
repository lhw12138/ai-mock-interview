import { describe, expect, it } from "vitest";
import {
  assertSafeModelBaseUrl,
  enforceJsonRequest,
  enforceRateLimit,
  readJsonBody,
  RequestBodyTooLargeError,
} from "./api-security";

describe("assertSafeModelBaseUrl", () => {
  it("rejects non-HTTPS upstreams", async () => {
    await expect(
      assertSafeModelBaseUrl("http://api.example.com/v1"),
    ).rejects.toThrow("HTTPS");
  });

  it("rejects localhost and private addresses before making a request", async () => {
    await expect(
      assertSafeModelBaseUrl("https://127.0.0.1/v1"),
    ).rejects.toThrow("不可用");
    await expect(
      assertSafeModelBaseUrl("https://169.254.169.254/latest"),
    ).rejects.toThrow("不可用");
    await expect(
      assertSafeModelBaseUrl("https://100.64.0.1/v1"),
    ).rejects.toThrow("不可用");
    await expect(
      assertSafeModelBaseUrl("https://[::ffff:127.0.0.1]/v1"),
    ).rejects.toThrow("不可用");
  });

  it("rejects non-default ports", async () => {
    await expect(
      assertSafeModelBaseUrl("https://8.8.8.8:8443/v1"),
    ).rejects.toThrow("443");
  });
});

describe("request boundary guards", () => {
  it("rejects cross-site or non-JSON browser requests", () => {
    const crossSite = new Request("https://app.example.com/api/interview", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://attacker.example",
        "sec-fetch-site": "cross-site",
      },
      body: "{}",
    });
    expect(enforceJsonRequest(crossSite)?.status).toBe(403);

    const plainText = new Request("https://app.example.com/api/interview", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "{}",
    });
    expect(enforceJsonRequest(plainText)?.status).toBe(415);
  });

  it("stops oversized streaming bodies before JSON parsing", async () => {
    const request = new Request("https://app.example.com/api/interview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ value: "x".repeat(200) }),
    });
    await expect(readJsonBody(request, 32)).rejects.toBeInstanceOf(
      RequestBodyTooLargeError,
    );
  });

  it("parses a valid body within the byte limit", async () => {
    const request = new Request("https://app.example.com/api/interview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ok: true }),
    });
    await expect(readJsonBody(request, 128)).resolves.toEqual({ ok: true });
  });
});

describe("enforceRateLimit", () => {
  it("returns a recoverable 429 after the configured limit", () => {
    const request = new Request("https://example.com/api", {
      headers: { "x-forwarded-for": "203.0.113.42" },
    });
    expect(
      enforceRateLimit(request, { bucket: "test", limit: 1, windowMs: 1000 }),
    ).toBeNull();
    const response = enforceRateLimit(request, {
      bucket: "test",
      limit: 1,
      windowMs: 1000,
    });
    expect(response?.status).toBe(429);
    expect(response?.headers.get("Retry-After")).toBeTruthy();
  });
});
