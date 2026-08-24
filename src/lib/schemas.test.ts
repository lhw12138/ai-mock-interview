import { describe, expect, it } from "vitest";
import { reportSchema } from "./schemas";

describe("reportSchema", () => {
  it("accepts evidence-based report fields", () => {
    const report = reportSchema.parse({
      dimensionScores: {
        logic: {
          score: 72,
          comment: "结构基本完整",
          evidence: "候选人先给出了结论",
          confidence: "high",
        },
      },
      perQuestion: [
        {
          answerSummary: "回答摘要",
          strengths: "先给结论",
          weaknesses: "缺少数据",
          evidence: "未提供量化结果",
          improvedAnswer: "补充可验证结果",
          score: 70,
          confidence: "medium",
        },
      ],
      overallFeedback: "基本合格",
      improvementSuggestions: ["补数据", "讲取舍", "做重答"],
      scoreBand: "基本合格",
      weeklyGoals: ["完成两次弱项重答"],
    });

    expect(report.dimensionScores.logic.evidence).toContain("结论");
    expect(report.perQuestion[0].score).toBe(70);
  });

  it("rejects scores outside the rubric range", () => {
    const result = reportSchema.safeParse({
      dimensionScores: { logic: { score: 101, comment: "" } },
      perQuestion: [],
      overallFeedback: "",
      improvementSuggestions: ["1", "2", "3"],
    });
    expect(result.success).toBe(false);
  });
});
