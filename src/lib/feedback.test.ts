import { describe, expect, it } from "vitest";
import {
  feedbackSchema,
  formatFeishuFeedback,
  isAllowedFeishuWebhook,
} from "./feedback";

describe("feedbackSchema", () => {
  it("accepts a valid feedback payload", () => {
    expect(
      feedbackSchema.parse({
        category: "评分不准",
        rating: 2,
        message: "评分没有引用我的原回答。",
        sourcePage: "/report",
      }),
    ).toMatchObject({ category: "评分不准", rating: 2 });
  });

  it("accepts concise feedback such as 好用", () => {
    expect(
      feedbackSchema.parse({
        category: "功能建议",
        rating: 5,
        message: "好用",
        sourcePage: "/report",
      }).message,
    ).toBe("好用");
  });

  it("rejects empty messages and external source URLs", () => {
    expect(() =>
      feedbackSchema.parse({
        category: "功能问题",
        rating: 5,
        message: "   ",
        sourcePage: "https://example.com",
      }),
    ).toThrow();
  });
});

describe("isAllowedFeishuWebhook", () => {
  it("allows official Feishu and Lark webhook URLs", () => {
    expect(
      isAllowedFeishuWebhook(
        "https://open.feishu.cn/open-apis/bot/v2/hook/abc_DEF-123",
      ),
    ).toBe(true);
    expect(
      isAllowedFeishuWebhook(
        "https://open.larksuite.com/open-apis/bot/v2/hook/abc123",
      ),
    ).toBe(true);
  });

  it("blocks other hosts, credentials, query strings and lookalike paths", () => {
    expect(
      isAllowedFeishuWebhook(
        "https://open.feishu.cn.evil.test/open-apis/bot/v2/hook/abc",
      ),
    ).toBe(false);
    expect(
      isAllowedFeishuWebhook(
        "https://open.feishu.cn/open-apis/bot/v2/hook/abc?redirect=1",
      ),
    ).toBe(false);
  });
});

describe("formatFeishuFeedback", () => {
  it("neutralizes mention-like markup and omits no fields", () => {
    const message = formatFeishuFeedback(
      {
        category: "功能建议",
        rating: 4,
        message: '<at user_id="all">所有人</at> 建议增加计时提示',
        contact: "user@example.com",
        sourcePage: "/interview",
      },
      { userAgent: "Test Browser", receivedAt: "2026/8/24 10:00:00" },
    );

    expect(message).toContain("＜at user_id");
    expect(message).toContain("满意度：4/5");
    expect(message).toContain("user@example.com");
  });
});
