import type { FalsePositiveReport } from "@/domain/entities/FalsePositiveReport";
import { extractFilePath } from "@/domain/entities/FalsePositiveReport";
import type { IFalsePositiveReportRepository } from "@/domain/repositories/IFalsePositiveReportRepository";
import type { IProjectRepository } from "@/domain/repositories/IProjectRepository";
import type { OWASPCategoryId } from "@/domain/value-objects/OWASPCategory";

export class ReportFalsePositiveError extends Error {}

export async function reportFalsePositive(
  projectId: string,
  requestingUserId: string,
  category: OWASPCategoryId,
  title: string,
  evidence: string,
  reason: string,
  projectRepo: IProjectRepository,
  fpRepo: IFalsePositiveReportRepository
): Promise<FalsePositiveReport> {
  const project = await projectRepo.findById(projectId);
  if (!project || project.userId !== requestingUserId) {
    throw new ReportFalsePositiveError("Project not found or access denied");
  }

  const filePath = extractFilePath(evidence);

  const existing = await fpRepo.findExisting(projectId, category, title, filePath);
  if (existing) {
    throw new ReportFalsePositiveError("A report for this finding already exists");
  }

  return fpRepo.create({ projectId, reportedById: requestingUserId, category, title, filePath, evidence, reason });
}
