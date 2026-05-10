import type { OWASPCategoryId } from "../value-objects/OWASPCategory";
import { getCategoryMap, getMaxScore } from "../value-objects/OWASPCategory";
import type { ScanMode } from "../value-objects/OWASPCategory";
import type { Severity } from "../value-objects/Severity";
import { SEVERITY_POINT_LOSS } from "../value-objects/Severity";

export type { ScanMode };

export interface RawFinding {
  category: OWASPCategoryId;
  severity: Severity;
  title: string;
  description: string;
  evidence?: string;
}

export interface ScoredFinding extends RawFinding {
  pointsLost: number;
}

export interface ScoreResult {
  score: number;
  maxScore: number;
  findings: ScoredFinding[];
  categoryBreakdown: Record<OWASPCategoryId, { score: number; maxScore: number }>;
}

export function calculateScore(rawFindings: RawFinding[], mode: ScanMode = "BASIC"): ScoreResult {
  const categoryMap = getCategoryMap(mode);
  const categoryLost: Partial<Record<OWASPCategoryId, number>> = {};

  const findings: ScoredFinding[] = rawFindings.map((f) => {
    const pointsLost = SEVERITY_POINT_LOSS[f.severity];
    categoryLost[f.category] = (categoryLost[f.category] ?? 0) + pointsLost;
    return { ...f, pointsLost };
  });

  const categoryBreakdown = {} as Record<OWASPCategoryId, { score: number; maxScore: number }>;
  let totalScore = 0;

  for (const [id, cat] of Object.entries(categoryMap) as [OWASPCategoryId, { maxPoints: number }][]) {
    const lost = Math.min(categoryLost[id] ?? 0, cat.maxPoints);
    const catScore = cat.maxPoints - lost;
    categoryBreakdown[id] = { score: catScore, maxScore: cat.maxPoints };
    totalScore += catScore;
  }

  return {
    score: Math.max(0, totalScore),
    maxScore: getMaxScore(mode),
    findings,
    categoryBreakdown,
  };
}
