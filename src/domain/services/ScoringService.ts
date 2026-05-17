import type { OWASPCategoryId } from "../value-objects/OWASPCategory";
import { OWASP_CATEGORIES, MAX_SCORE, isEvaluated } from "../value-objects/OWASPCategory";
import type { ScanMode } from "../value-objects/OWASPCategory";
import type { Severity } from "../value-objects/Severity";
import { SEVERITY_POINT_LOSS } from "../value-objects/Severity";

export type { ScanMode };

export type CategoryStatus = "evaluated" | "not_evaluated";

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

export interface CategoryBreakdownEntry {
  score: number;
  maxScore: number;
  status: CategoryStatus;
}

export interface ScoreResult {
  score: number;
  maxScore: number;
  findings: ScoredFinding[];
  categoryBreakdown: Record<OWASPCategoryId, CategoryBreakdownEntry>;
}

export function calculateScore(
  rawFindings: RawFinding[],
  mode: ScanMode = "PASSIVE",
  additionalUnevaluated: ReadonlySet<OWASPCategoryId> = new Set()
): ScoreResult {
  const categoryLost: Partial<Record<OWASPCategoryId, number>> = {};

  const findings: ScoredFinding[] = rawFindings.map((f) => {
    const pointsLost = SEVERITY_POINT_LOSS[f.severity];
    categoryLost[f.category] = (categoryLost[f.category] ?? 0) + pointsLost;
    return { ...f, pointsLost };
  });

  const categoryBreakdown = {} as Record<OWASPCategoryId, CategoryBreakdownEntry>;
  let totalScore = 0;

  for (const [id, cat] of Object.entries(OWASP_CATEGORIES) as [OWASPCategoryId, { maxPoints: number }][]) {
    const evaluated = isEvaluated(id, mode) && !additionalUnevaluated.has(id);

    if (!evaluated) {
      // Not evaluated: category contributes its full max (no deductions possible)
      categoryBreakdown[id] = { score: cat.maxPoints, maxScore: cat.maxPoints, status: "not_evaluated" };
      totalScore += cat.maxPoints;
    } else {
      const lost = Math.min(categoryLost[id] ?? 0, cat.maxPoints);
      const catScore = cat.maxPoints - lost;
      categoryBreakdown[id] = { score: catScore, maxScore: cat.maxPoints, status: "evaluated" };
      totalScore += catScore;
    }
  }

  return {
    score: Math.max(0, totalScore),
    maxScore: MAX_SCORE,
    findings,
    categoryBreakdown,
  };
}
