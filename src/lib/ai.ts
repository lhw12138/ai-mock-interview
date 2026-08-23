import { createOpenAI } from "@ai-sdk/openai";

export interface ModelOverrides {
  baseUrl?: string;
  model?: string;
  apiKey?: string;
}

function isDeepSeekBaseUrl(baseUrl: string): boolean {
  try {
    const host = new URL(baseUrl).hostname;
    return host === "api.deepseek.com" || host.endsWith(".deepseek.com");
  } catch {
    return false;
  }
}

function getApiKey(override: string | undefined, baseUrl: string): string {
  const apiKey =
    override || (isDeepSeekBaseUrl(baseUrl) ? process.env.DEEPSEEK_API_KEY : "");
  if (!apiKey) {
    throw new Error("该服务商需要填写 API Key 才能使用。");
  }
  return apiKey;
}

function isZhipuBaseUrl(baseUrl: string): boolean {
  try {
    const host = new URL(baseUrl).hostname;
    return host === "open.bigmodel.cn" || host.endsWith(".bigmodel.cn");
  } catch {
    return false;
  }
}

/**
 * 智谱 GLM-4.5/4.7 系列默认是"思考型"模型，会把结构化输出包进 markdown
 * 代码块并先输出大段推理内容，导致流式 JSON 解析失败。这里在请求发出前
 * 强制关闭思考模式，保证返回纯净 JSON。
 */
function createZhipuFetch(): typeof fetch {
  return async (input, init) => {
    if (init && typeof init.body === "string") {
      try {
        const parsed = JSON.parse(init.body);
        if (
          parsed &&
          typeof parsed === "object" &&
          Array.isArray(parsed.messages)
        ) {
          parsed.thinking = { type: "disabled" };
          init.body = JSON.stringify(parsed);
        }
      } catch {
        // 非 JSON body 直接放行
      }
    }
    return fetch(input, init);
  };
}

export function getDeepSeekModel(overrides?: ModelOverrides) {
  const baseUrl =
    overrides?.baseUrl ||
    process.env.AI_BASE_URL ||
    "https://api.deepseek.com";

  const openai = createOpenAI({
    apiKey: getApiKey(overrides?.apiKey, baseUrl),
    baseURL: baseUrl,
    ...(isZhipuBaseUrl(baseUrl) ? { fetch: createZhipuFetch() } : {}),
  });

  return openai(overrides?.model || process.env.AI_MODEL || "deepseek-v4-flash");
}
