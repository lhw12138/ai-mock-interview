import { z } from "zod";

export const feedbackCategories = [
  "功能问题",
  "评分不准",
  "使用困难",
  "功能建议",
] as const;

export const feedbackSchema = z.object({
  category: z.enum(feedbackCategories),
  rating: z.number().int().min(1).max(5),
  message: z.string().trim().min(1).max(2000),
  contact: z.string().trim().max(120).optional(),
  sourcePage: z
    .string()
    .trim()
    .max(200)
    .refine((value) => value.startsWith("/") && !value.startsWith("//")),
});

export type FeedbackPayload = z.infer<typeof feedbackSchema>;

export function isAllowedFeishuWebhook(value: string): boolean {
  try {
    const url = new URL(value);
    const allowedHost =
      url.hostname === "open.feishu.cn" ||
      url.hostname === "open.larksuite.com";
    return (
      url.protocol === "https:" &&
      allowedHost &&
      /^\/open-apis\/bot\/v2\/hook\/[A-Za-z0-9_-]+$/.test(url.pathname) &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}

function cleanPlainText(value: string): string {
  return value
    .replace(/[<>]/g, (character) => (character === "<" ? "＜" : "＞"))
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim();
}

export function formatFeishuFeedback(
  feedback: FeedbackPayload,
  context: { userAgent: string; receivedAt: string },
): string {
  const contact = feedback.contact?.trim() || "未填写";
  return [
    "【AI 面试助手 · 用户反馈】",
    `类型：${cleanPlainText(feedback.category)}`,
    `满意度：${feedback.rating}/5`,
    `来源页面：${cleanPlainText(feedback.sourcePage)}`,
    `联系方式：${cleanPlainText(contact)}`,
    `设备：${cleanPlainText(context.userAgent).slice(0, 300) || "未知"}`,
    `时间：${context.receivedAt}`,
    "",
    "反馈内容：",
    cleanPlainText(feedback.message),
  ].join("\n");
}
