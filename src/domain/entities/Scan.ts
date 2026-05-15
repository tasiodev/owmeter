import type { OWASPCategoryId } from "../value-objects/OWASPCategory";
import type { Severity } from "../value-objects/Severity";

export type ScanStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "INVALID";
export type ScanType = "PASSIVE" | "FULL" | "CODE";

export interface Finding {
  id: string;
  scanId: string;
  category: OWASPCategoryId;
  severity: Severity;
  title: string;
  description: string;
  evidence: string | null;
  pointsLost: number;
}

export interface Scan {
  id: string;
  projectId: string;
  status: ScanStatus;
  type: ScanType;
  score: number | null;
  maxScore: number | null;
  inRanking: boolean;
  errorMessage: string | null;
  findings: Finding[];
  startedAt: Date;
  completedAt: Date | null;
}
