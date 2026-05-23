import type { OWASPCategoryId } from "@/domain/value-objects/OWASPCategory";

export type FalsePositiveStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface FalsePositiveReport {
  id: string;
  projectId: string;
  reportedById: string;
  category: OWASPCategoryId;
  title: string;
  filePath: string;
  evidence: string;
  reason: string;
  status: FalsePositiveStatus;
  reviewedById: string | null;
  reviewedAt: Date | null;
  adminNote: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Stable fingerprint used to suppress a finding in future scans */
export function fpKey(category: OWASPCategoryId, title: string, filePath: string): string {
  return `${category}:${title}:${filePath}`;
}

/**
 * Extracts the source file path from an evidence string.
 * Evidence format for code findings: "src/foo/bar.tsx:42 — <snippet>"
 * Passive findings have no file path → returns "".
 */
export function extractFilePath(evidence: string | null | undefined): string {
  if (!evidence) return "";
  const match = evidence.match(/^(.+?):\d+\s*[—-]/);
  return match ? match[1].trim() : "";
}
