import { describe, expect, it } from "vitest";
import { buildInterviewPrompt, buildReportPrompt } from "./prompts";

const question = {
  id: 1001,
  question: "请解释浏览器事件循环。",
  category: "前端·基础·浏览器",
  answer: "说明宏任务、微任务与渲染机会。",
};

describe("role-specific prompts", () => {
  it("uses a frontend interviewer instead of an AI interviewer", () => {
    const prompt = buildInterviewPrompt({
      role: "frontend",
      questions: [question],
      currentIndex: 0,
      totalQuestions: 1,
      followUpCount: 0,
      conversation: [],
      currentAnswer: "候选人回答",
    });

    expect(prompt.system).toContain("前端开发工程师面试官");
    expect(prompt.system).not.toContain("擅长 Agent 开发");
  });

  it("treats reference answers as anchors rather than the only answer", () => {
    const prompt = buildReportPrompt({
      role: "frontend",
      questions: [question],
      conversation: [],
    });

    expect(prompt.system).toContain("参考答案只是评分锚点，不是唯一标准");
    expect(prompt.prompt).toContain("参考要点（不是唯一答案）");
    expect(prompt.system).toContain("performanceQuality");
  });

  it("uses data-analysis scoring dimensions", () => {
    const prompt = buildReportPrompt({
      role: "data_analyst",
      questions: [question],
      conversation: [],
    });

    expect(prompt.system).toContain("sqlDataProcessing");
    expect(prompt.system).toContain("statisticsExperiment");
    expect(prompt.system).toContain("businessInsight");
  });

  it("uses operations scoring dimensions", () => {
    const prompt = buildReportPrompt({
      role: "operations",
      questions: [question],
      conversation: [],
    });

    expect(prompt.system).toContain("growthStrategy");
    expect(prompt.system).toContain("userLifecycle");
    expect(prompt.system).toContain("dataDecision");
  });

  it("uses the custom interview title and generic evidence dimensions", () => {
    const prompt = buildInterviewPrompt({
      role: "custom",
      customInterviewTitle: "人工智能专业研究生复试",
      customInterviewContext: "重点考察科研动机",
      resume: "参与过多模态检索项目",
      questions: [question],
      currentIndex: 0,
      totalQuestions: 1,
      followUpCount: 0,
      conversation: [],
      currentAnswer: "候选人回答",
    });
    const report = buildReportPrompt({
      role: "custom",
      customInterviewTitle: "人工智能专业研究生复试",
      questions: [question],
      conversation: [],
    });

    expect(prompt.system).toContain("人工智能专业研究生复试");
    expect(prompt.prompt).toContain("重点考察科研动机");
    expect(prompt.prompt).toContain("参与过多模态检索项目");
    expect(report.system).toContain("knowledgeDepth");
  });
});
