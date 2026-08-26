import { describe, expect, it } from "vitest";
import {
  frontendQuestions,
  dataAnalystQuestions,
  javaBackendQuestions,
  jobQuestionMap,
  operationsQuestions,
} from "./questions";

function getDifficultyCounts(questions: typeof frontendQuestions) {
  return questions.reduce<Record<string, number>>((counts, question) => {
    const difficulty = question.category.split("·")[1] ?? "未知";
    counts[difficulty] = (counts[difficulty] ?? 0) + 1;
    return counts;
  }, {});
}

describe("built-in engineering question banks", () => {
  it("loads 100 validated questions for each new role", () => {
    expect(frontendQuestions).toHaveLength(100);
    expect(javaBackendQuestions).toHaveLength(100);
    expect(dataAnalystQuestions).toHaveLength(100);
    expect(operationsQuestions).toHaveLength(100);
    expect(jobQuestionMap["前端开发工程师"]).toBe(frontendQuestions);
    expect(jobQuestionMap["Java后端开发工程师"]).toBe(javaBackendQuestions);
    expect(jobQuestionMap["数据分析师"]).toBe(dataAnalystQuestions);
    expect(jobQuestionMap["运营"]).toBe(operationsQuestions);
  });

  it("keeps IDs unique across all new banks", () => {
    const ids = [
      ...frontendQuestions,
      ...javaBackendQuestions,
      ...dataAnalystQuestions,
      ...operationsQuestions,
    ].map((question) => question.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("preserves the intended difficulty distribution", () => {
    expect(getDifficultyCounts(frontendQuestions)).toEqual({
      基础: 30,
      进阶: 50,
      困难: 20,
    });
    expect(getDifficultyCounts(javaBackendQuestions)).toEqual({
      基础: 30,
      进阶: 50,
      困难: 20,
    });
    expect(getDifficultyCounts(dataAnalystQuestions)).toEqual({
      基础: 30,
      进阶: 50,
      困难: 20,
    });
    expect(getDifficultyCounts(operationsQuestions)).toEqual({
      基础: 30,
      进阶: 50,
      困难: 20,
    });
  });
});
