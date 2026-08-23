import { jobQuestionMap, type Question } from "./questions";
import type { RoleKey } from "./types";
import { loadCustomQuestions, loadSessions } from "./storage";

export interface RoleOption {
  key: RoleKey;
  label: string;
}

export const ROLE_OPTIONS: RoleOption[] = [
  { key: "ai_pm", label: "AI产品经理" },
  { key: "pm", label: "产品经理" },
  { key: "agent_dev", label: "AGENT开发工程师" },
  { key: "llm_dev", label: "大模型应用开发工程师" },
];

const DEFAULT_POOL_BY_ROLE: Record<RoleKey, string> = {
  ai_pm: "AI产品经理",
  pm: "产品经理",
  agent_dev: "AGENT开发工程师",
  llm_dev: "大模型应用开发工程师",
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
