import type { DimensionScores, RoleKey } from "./types";

export interface DimensionDefinition {
  key: string;
  label: string;
  weight: number;
}

// 产品类岗位：保持原有五维
const PM_DIMENSIONS: DimensionDefinition[] = [
  { key: "logic", label: "逻辑思维", weight: 0.25 },
  { key: "productSense", label: "产品 sense", weight: 0.25 },
  { key: "communication", label: "表达沟通", weight: 0.2 },
  { key: "aiUnderstanding", label: "AI 理解力", weight: 0.15 },
  { key: "adaptability", label: "应变能力", weight: 0.15 },
];

// 技术类岗位：侧重技术深度与工程能力
const TECH_DIMENSIONS: DimensionDefinition[] = [
  { key: "techDepth", label: "技术深度", weight: 0.25 },
  { key: "systemDesign", label: "系统设计", weight: 0.25 },
  { key: "engineering", label: "工程实践", weight: 0.2 },
  { key: "communication", label: "表达沟通", weight: 0.15 },
  { key: "adaptability", label: "应变能力", weight: 0.15 },
];

export const DIMENSION_DEFS_BY_ROLE: Record<RoleKey, DimensionDefinition[]> = {
  ai_pm: PM_DIMENSIONS,
  pm: PM_DIMENSIONS,
  agent_dev: TECH_DIMENSIONS,
  llm_dev: TECH_DIMENSIONS,
};

export function getDimensionDefs(role: RoleKey): DimensionDefinition[] {
  return DIMENSION_DEFS_BY_ROLE[role] ?? PM_DIMENSIONS;
}

export function calculateTotalScore(
  scores: DimensionScores,
  role: RoleKey,
): number {
  const total = getDimensionDefs(role).reduce(
    (sum, definition) =>
      sum + (scores[definition.key]?.score ?? 0) * definition.weight,
    0,
  );

  return Math.min(100, Math.max(0, Math.round(total)));
}
