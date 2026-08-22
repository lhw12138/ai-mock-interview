import { getQuestions, type Question } from "./questions";
import type { RoleKey } from "./types";

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
  return getQuestions(getRoleLabel(role), count);
}
