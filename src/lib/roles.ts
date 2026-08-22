import { getQuestions, type Question } from "./questions";
import type { RoleKey } from "./types";
import { loadCustomQuestions } from "./storage";

export interface RoleOption {
  key: RoleKey;
  label: string;
}

export const ROLE_OPTIONS: RoleOption[] = [
  { key: "ai_pm", label: "AI产品经理" },
  { key: "pm", label: "产品经理" },
];

export function getRoleLabel(role: RoleKey): string {
  return ROLE_OPTIONS.find((option) => option.key === role)?.label ?? "AI产品经理";
}

export function getQuestionsForRole(role: RoleKey, count: number): Question[] {
  const builtIn = getQuestions(getRoleLabel(role), count);
  const custom = loadCustomQuestions()
    .filter((question) => question.role === role)
    .map((question) => ({
      id: question.id,
      question: question.question,
      category: question.category,
      answer: question.answer,
    }));
  const pool = [...custom, ...builtIn];
  const shuffled = [...pool];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [
      shuffled[randomIndex],
      shuffled[index],
    ];
  }

  return shuffled.slice(0, Math.min(count, shuffled.length));
}
