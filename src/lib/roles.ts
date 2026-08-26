import { jobQuestionMap, type Question } from "./questions";
import type { RoleKey } from "./types";
import { loadCustomQuestions, loadSessions } from "./storage";

export interface RoleOption {
  key: RoleKey;
  label: string;
  description: string;
}

export const ROLE_OPTIONS: RoleOption[] = [
  { key: "ai_pm", label: "AI产品经理", description: "大模型应用 + 通用产品题" },
  { key: "pm", label: "产品经理", description: "通用产品经理高频题" },
  { key: "agent_dev", label: "AGENT开发工程师", description: "Agent 架构、工具调用与多 Agent 系统" },
  { key: "llm_dev", label: "大模型应用开发工程师", description: "RAG、Prompt、微调与推理部署" },
  { key: "frontend", label: "前端开发工程师", description: "JavaScript、框架、工程化与性能优化" },
  { key: "java_backend", label: "Java后端开发工程师", description: "Java、Spring、数据库与分布式系统" },
  { key: "data_analyst", label: "数据分析师", description: "SQL、统计实验、业务分析与数据可视化" },
  { key: "operations", label: "运营", description: "用户增长、内容活动、商业化与数据运营" },
];

export const UPCOMING_ROLE_OPTIONS: ReadonlyArray<{
  key: string;
  label: string;
  description: string;
}> = [];

const DEFAULT_POOL_BY_ROLE: Record<RoleKey, string> = {
  ai_pm: "AI产品经理",
  pm: "产品经理",
  agent_dev: "AGENT开发工程师",
  llm_dev: "大模型应用开发工程师",
  frontend: "前端开发工程师",
  java_backend: "Java后端开发工程师",
  data_analyst: "数据分析师",
  operations: "运营",
};

export function getRoleLabel(role: RoleKey): string {
  return ROLE_OPTIONS.find((option) => option.key === role)?.label ?? "AI产品经理";
}

export function getQuestionsForRole(
  role: RoleKey,
  count: number,
  options?: { avoidRecent?: boolean },
): Question[] {
  const custom = loadCustomQuestions()
    .filter((question) => question.role === role)
    .map((question) => ({
      id: question.id,
      question: question.question,
      category: question.category,
      answer: question.answer,
    }));

  const builtInPool = jobQuestionMap[DEFAULT_POOL_BY_ROLE[role]] ?? [];
  let freshBuiltIn = builtInPool;
  if (options?.avoidRecent) {
    const recentQuestionIds = new Set(
      loadSessions()
        .filter((session) => session.role === role)
        .slice(0, 3)
        .flatMap((session) => session.questions.map((question) => question.id)),
    );
    freshBuiltIn = builtInPool.filter(
      (question) => !recentQuestionIds.has(question.id),
    );
  }

  const pool = [...custom, ...freshBuiltIn];
  const shuffled = [...pool];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [
      shuffled[randomIndex],
      shuffled[index],
    ];
  }

  if (shuffled.length < count) {
    const seenIds = new Set(shuffled.map((question) => question.id));
    for (const question of builtInPool) {
      if (!seenIds.has(question.id)) {
        shuffled.push(question);
        seenIds.add(question.id);
      }
    }
  }

  return shuffled.slice(0, Math.min(count, shuffled.length));
}
