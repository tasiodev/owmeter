import type { IScanRepository } from "@/domain/repositories/IScanRepository";
import type { IProjectRepository } from "@/domain/repositories/IProjectRepository";
import type { Scan } from "@/domain/entities/Scan";
import { resolveBaseUrl } from "@/domain/entities/Project";
import type { RawFinding } from "@/domain/services/ScoringService";
import type { OWASPCategoryId } from "@/domain/value-objects/OWASPCategory";

export type FullZipScanJobData = {
  scanId: string;
  targetUrl: string;
  type: "FULL_ZIP";
  sastFindings: RawFinding[];
  sastUnevaluated: OWASPCategoryId[];
};

export class CreateFullScanFromZipError extends Error {}

export async function createFullScanFromZip(
  projectId: string,
  requestingUserId: string,
  sastFindings: RawFinding[],
  projectRepo: IProjectRepository,
  scanRepo: IScanRepository,
  enqueue: (jobData: FullZipScanJobData) => Promise<void>,
  unevaluated: ReadonlySet<OWASPCategoryId> = new Set()
): Promise<Scan> {
  const project = await projectRepo.findById(projectId);

  if (!project) throw new CreateFullScanFromZipError("Project not found");
  if (project.userId !== requestingUserId) throw new CreateFullScanFromZipError("Unauthorized");
  if (project.type !== "WEBSITE") throw new CreateFullScanFromZipError("Full scan only applies to WEBSITE projects");
  if (!project.verified) throw new CreateFullScanFromZipError("Domain ownership not verified");
  if (!project.domain) throw new CreateFullScanFromZipError("Project has no domain configured");

  const scan = await scanRepo.create(projectId, "FULL");

  await enqueue({
    scanId: scan.id,
    targetUrl: resolveBaseUrl(project.domain),
    type: "FULL_ZIP",
    sastFindings,
    sastUnevaluated: [...unevaluated],
  });

  return scan;
}
