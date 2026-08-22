import type { DimensionScores } from "./types";

export const DIMENSION_WEIGHTS = {
  logic: 0.25,
  productSense: 0.25,
  communication: 0.2,
  aiUnderstanding: 0.15,
  adaptability: 0.15,
} as const;

export function calculateTotalScore(scores: DimensionScores): number {
  const total =
    scores.logic.score * DIMENSION_WEIGHTS.logic +
    scores.productSense.score * DIMENSION_WEIGHTS.productSense +
    scores.communication.score * DIMENSION_WEIGHTS.communication +
    scores.aiUnderstanding.score * DIMENSION_WEIGHTS.aiUnderstanding +
    scores.adaptability.score * DIMENSION_WEIGHTS.adaptability;

  return Math.min(100, Math.max(0, Math.round(total)));
}
