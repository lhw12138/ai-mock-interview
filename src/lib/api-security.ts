import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

interface RateLimitOptions {
  bucket: string;
  limit: number;
  windowMs: number;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const globalStore = globalThis as typeof globalThis & {
  __mockInterviewRateLimits?: Map<string, RateLimitEntry>;
};

const rateLimits =
  globalStore.__mockInterviewRateLimits ?? new Map<string, RateLimitEntry>();
globalStore.__mockInterviewRateLimits = rateLimits;

const MAX_RATE_LIMIT_KEYS = 10000;

export class RequestBodyTooLargeError extends Error {
  constructor() {
    super("REQUEST_BODY_TOO_LARGE");
    this.name = "RequestBodyTooLargeError";
  }
}

export function enforceSameOriginRequest(request: Request): Response | null {
  if (request.headers.get("sec-fetch-site") === "cross-site") {
    return Response.json({ error: "不允许跨站调用该接口。" }, { status: 403 });
  }

  const origin = request.headers.get("origin");
  if (!origin) return null;

  try {
    const originHost = new URL(origin).host.toLowerCase();
    const requestHost = new URL(request.url).host.toLowerCase();
    const forwardedHost = request.headers
      .get("x-forwarded-host")
      ?.split(",")[0]
      ?.trim()
      .toLowerCase();
    const host = request.headers.get("host")?.trim().toLowerCase();
    const allowedHosts = new Set(
      [requestHost, forwardedHost, host].filter(
        (value): value is string => Boolean(value),
      ),
    );
    if (!allowedHosts.has(originHost)) {
      return Response.json({ error: "不允许跨站调用该接口。" }, { status: 403 });
    }
  } catch {
    return Response.json({ error: "请求来源不正确。" }, { status: 403 });
  }

  return null;
}

export function enforceJsonRequest(request: Request): Response | null {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) {
    return Response.json(
      { error: "请求格式不正确，请使用 JSON。" },
      { status: 415 },
    );
  }
  return enforceSameOriginRequest(request);
}

export async function readJsonBody(
  request: Request,
  maxBytes: number,
): Promise<unknown> {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength) {
    const parsedLength = Number(declaredLength);
    if (Number.isFinite(parsedLength) && parsedLength > maxBytes) {
      throw new RequestBodyTooLargeError();
    }
  }

  if (!request.body) return {};
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let bytesRead = 0;
  let text = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytesRead += value.byteLength;
    if (bytesRead > maxBytes) {
      await reader.cancel();
      throw new RequestBodyTooLargeError();
    }
    text += decoder.decode(value, { stream: true });
  }

  text += decoder.decode();
  return JSON.parse(text);
}

function getClientKey(request: Request): string {
  const candidates = [
    request.headers.get("cf-connecting-ip"),
    request.headers.get("x-real-ip"),
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
  ];
  return candidates.find((candidate) => candidate && isIP(candidate)) ?? "unknown";
}

export function enforceRateLimit(
  request: Request,
  options: RateLimitOptions,
): Response | null {
  const now = Date.now();
  let key = `${options.bucket}:${getClientKey(request)}`;
  if (!rateLimits.has(key) && rateLimits.size >= MAX_RATE_LIMIT_KEYS) {
    rateLimits.forEach((storedEntry, storedKey) => {
      if (storedEntry.resetAt <= now) rateLimits.delete(storedKey);
    });
    if (rateLimits.size >= MAX_RATE_LIMIT_KEYS) {
      key = `${options.bucket}:overflow`;
    }
  }
  const existing = rateLimits.get(key);
  const entry =
    existing && existing.resetAt > now
      ? existing
      : { count: 0, resetAt: now + options.windowMs };

  entry.count += 1;
  rateLimits.set(key, entry);

  if (entry.count <= options.limit) return null;

  const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
  return Response.json(
    { error: `请求过于频繁，请在 ${retryAfter} 秒后重试。` },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfter) },
    },
  );
}

function isBlockedIpv4(address: string): boolean {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
    return true;
  }

  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    (a === 100 && b >= 64 && b <= 127) ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isBlockedIp(address: string): boolean {
  const normalizedAddress = address.replace(/^\[|\]$/g, "").toLowerCase();
  const version = isIP(normalizedAddress);
  if (version === 4) return isBlockedIpv4(normalizedAddress);
  if (version === 6) {
    const normalized = normalizedAddress;
    if (normalized.startsWith("::ffff:")) {
      const mapped = normalized.slice("::ffff:".length);
      if (isIP(mapped) === 4) return isBlockedIpv4(mapped);
      const groups = mapped.split(":");
      if (groups.length === 2) {
        const high = Number.parseInt(groups[0], 16);
        const low = Number.parseInt(groups[1], 16);
        if (Number.isFinite(high) && Number.isFinite(low)) {
          return isBlockedIpv4(
            `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`,
          );
        }
      }
    }
    return (
      normalized === "::" ||
      normalized === "::1" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe8") ||
      normalized.startsWith("fe9") ||
      normalized.startsWith("fea") ||
      normalized.startsWith("feb") ||
      normalized.startsWith("fec") ||
      normalized.startsWith("fed") ||
      normalized.startsWith("fee") ||
      normalized.startsWith("fef") ||
      normalized.startsWith("ff") ||
      normalized.startsWith("2001:db8:")
    );
  }
  return false;
}

export async function assertSafeModelBaseUrl(value?: string): Promise<void> {
  if (!value?.trim()) return;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("API 地址格式不正确，请填写完整的 HTTPS 地址。");
  }

  if (url.protocol !== "https:") {
    throw new Error("API 地址必须使用 HTTPS。");
  }
  if (url.username || url.password || url.hash) {
    throw new Error("API 地址不能包含账号、密码或页面锚点。");
  }
  if (url.port && url.port !== "443") {
    throw new Error("API 地址仅允许使用 HTTPS 默认端口 443。");
  }

  const hostname = url.hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .replace(/\.$/, "");
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    isBlockedIp(hostname)
  ) {
    throw new Error("该 API 地址不可用，请填写公开的模型服务地址。");
  }

  try {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const addresses = await Promise.race([
      lookup(hostname, { all: true, verbatim: true }),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("timeout")), 3000);
      }),
    ]).finally(() => {
      if (timeout) clearTimeout(timeout);
    });
    if (addresses.length === 0 || addresses.some((item) => isBlockedIp(item.address))) {
      throw new Error("blocked");
    }
  } catch {
    throw new Error("无法验证该 API 地址，请检查域名后重试。");
  }
}

export function getPublicAiError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : "";
  const safePatterns = [
    /API 地址/,
    /API Key/,
    /请求过于频繁/,
    /必须使用 HTTPS/,
    /无法验证该 API 地址/,
  ];
  return safePatterns.some((pattern) => pattern.test(message)) ? message : fallback;
}
