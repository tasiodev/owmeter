import type { IScanRepository } from "@/domain/repositories/IScanRepository";
import type { IProjectRepository } from "@/domain/repositories/IProjectRepository";
import type { Scan } from "@/domain/entities/Scan";
import { calculateScore } from "@/domain/services/ScoringService";
import type { RawFinding } from "@/domain/services/ScoringService";
import type { OWASPCategoryId } from "@/domain/value-objects/OWASPCategory";

export class CreateCodeScanFromZipError extends Error {}

export async function createCodeScanFromZip(
  projectId: string,
  requestingUserId: string,
  rawFindings: RawFinding[],
  projectRepo: IProjectRepository,
  scanRepo: IScanRepository,
  unevaluated: ReadonlySet<OWASPCategoryId> = new Set()
): Promise<Scan> {
  const project = await projectRepo.findById(projectId);

  if (!project) throw new CreateCodeScanFromZipError("Project not found");
  if (project.userId !== requestingUserId) throw new CreateCodeScanFromZipError("Unauthorized");
  if (project.type !== "CODE_REPO") throw new CreateCodeScanFromZipError("Code scan only applies to CODE_REPO projects");

  const scan = await scanRepo.create(projectId, "CODE");
  await scanRepo.updateStatus(scan.id, "RUNNING");

  const { score, maxScore, findings } = calculateScore(rawFindings, "CODE", unevaluated);
  return scanRepo.complete(scan.id, score, maxScore, findings);
}
