import { createOpenAI } from "@ai-sdk/openai";

function getApiKey(): string {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("未配置 DEEPSEEK_API_KEY，请先在环境变量中设置。");
  }
  return apiKey;
}

export function getDeepSeekModel() {
  const openai = createOpenAI({
    apiKey: getApiKey(),
    baseURL: process.env.AI_BASE_URL || "https://api.deepseek.com",
  });

  return openai(process.env.AI_MODEL || "deepseek-chat");
}
