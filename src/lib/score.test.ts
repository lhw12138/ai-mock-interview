import { describe, expect, it } from "vitest";
import { calculateTotalScore, getDimensionDefs } from "./score";

describe("calculateTotalScore", () => {
  it("uses the configured role weights", () => {
    const result = calculateTotalScore(
      {
        logic: { score: 80, comment: "" },
        productSense: { score: 60, comment: "" },
        communication: { score: 70, comment: "" },
        aiUnderstanding: { score: 90, comment: "" },
        adaptability: { score: 50, comment: "" },
      },
      "ai_pm",
    );

    expect(result).toBe(70);
  });

  it("keeps every role definition normalized to 100%", () => {
    for (const role of ["ai_pm", "pm", "agent_dev", "llm_dev"] as const) {
      const totalWeight = getDimensionDefs(role).reduce(
        (sum, dimension) => sum + dimension.weight,
        0,
      );
      expect(totalWeight).toBeCloseTo(1);
    }
  });
});
