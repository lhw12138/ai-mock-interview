import { afterEach, describe, expect, it, vi } from "vitest";
import { IatAsr } from "./iat-asr";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("IatAsr lifecycle", () => {
  it("does not reopen capture after being disposed during auth", async () => {
    let resolveFetch: ((response: Response) => void) | undefined;
    const fetchPromise = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    vi.stubGlobal("fetch", vi.fn(() => fetchPromise));

    const onError = vi.fn();
    const engine = new IatAsr({
      onText: vi.fn(),
      onError,
      onEnd: vi.fn(),
    });

    const starting = engine.start();
    engine.dispose();
    resolveFetch?.(
      Response.json({
        url: "wss://iat-api.xfyun.cn/v2/iat?authorization=test",
        appId: "test-app",
      }),
    );
    await starting;

    expect(onError).not.toHaveBeenCalled();
  });

  it("rejects an unexpected websocket destination", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          url: "wss://attacker.example/v2/iat",
          appId: "test-app",
        }),
      ),
    );
    const onError = vi.fn();
    const engine = new IatAsr({
      onText: vi.fn(),
      onError,
      onEnd: vi.fn(),
    });

    await engine.start();

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("无效地址"),
      }),
    );
  });
});
