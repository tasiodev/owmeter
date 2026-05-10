import type { OWASPCategoryId } from "../value-objects/OWASPCategory";
import type { Severity } from "../value-objects/Severity";

export type ScanStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";

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
  websiteId: string;
  status: ScanStatus;
  score: number | null;
  maxScore: number | null;
  inRanking: boolean;
  findings: Finding[];
  startedAt: Date;
  completedAt: Date | null;
}
