import { describe, expect, it } from "vitest";
import { calculateTotalScore, getDimensionDefs } from "./score";
import { ROLE_KEYS } from "./types";

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
    for (const role of ROLE_KEYS) {
      const totalWeight = getDimensionDefs(role).reduce(
        (sum, dimension) => sum + dimension.weight,
        0,
      );
      expect(totalWeight).toBeCloseTo(1);
    }
  });

  it("uses role-specific dimensions for frontend and Java backend", () => {
    expect(getDimensionDefs("frontend").map((item) => item.key)).toContain(
      "performanceQuality",
    );
    expect(getDimensionDefs("java_backend").map((item) => item.key)).toContain(
      "dataMiddleware",
    );
    expect(getDimensionDefs("data_analyst").map((item) => item.key)).toContain(
      "businessInsight",
    );
    expect(getDimensionDefs("operations").map((item) => item.key)).toContain(
      "growthStrategy",
    );
  });
});
