import { describe, expect, it } from "vitest";
import {
  getQuestionsForRole,
  ROLE_OPTIONS,
  UPCOMING_ROLE_OPTIONS,
} from "./roles";

describe("engineering roles", () => {
  it.each([
    ["frontend", "前端开发工程师"],
    ["java_backend", "Java后端开发工程师"],
    ["data_analyst", "数据分析师"],
    ["operations", "运营"],
  ] as const)("selects unique built-in questions for %s", (role, label) => {
    const questions = getQuestionsForRole(role, 10);
    expect(questions).toHaveLength(10);
    expect(new Set(questions.map((question) => question.id)).size).toBe(10);
    expect(ROLE_OPTIONS).toContainEqual(
      expect.objectContaining({ key: role, label }),
    );
  });

  it("activates every prepared role and leaves no placeholder", () => {
    expect(UPCOMING_ROLE_OPTIONS).toEqual([]);
    expect(ROLE_OPTIONS.map((role) => role.key)).toContain("data_analyst");
    expect(ROLE_OPTIONS.map((role) => role.key)).toContain("operations");
  });
});
