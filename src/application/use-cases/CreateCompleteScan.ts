import type { IScanRepository } from "@/domain/repositories/IScanRepository";
import type { IProjectRepository } from "@/domain/repositories/IProjectRepository";
import type { Scan } from "@/domain/entities/Scan";
import { resolveBaseUrl } from "@/domain/entities/Project";

export type FullScanJobData = {
  scanId: string;
  targetUrl: string;
  type: "FULL";
  repoUrl: string;
  githubInstallationId?: number; // set for private repos accessed via GitHub App
};

export class CreateCompleteScanError extends Error {}

export async function createCompleteScan(
  projectId: string,
  requestingUserId: string,
  projectRepo: IProjectRepository,
  scanRepo: IScanRepository,
  enqueue: (jobData: FullScanJobData) => Promise<void>
): Promise<Scan> {
  const project = await projectRepo.findById(projectId);

  if (!project) throw new CreateCompleteScanError("Project not found");
  if (project.userId !== requestingUserId) throw new CreateCompleteScanError("Unauthorized");
  if (project.type !== "WEBSITE") throw new CreateCompleteScanError("Full scan only applies to WEBSITE projects");
  if (!project.verified) throw new CreateCompleteScanError("Domain ownership not verified");
  if (!project.domain) throw new CreateCompleteScanError("Project has no domain configured");
  if (!project.repoVerified || !project.repoUrl) {
    throw new CreateCompleteScanError("Repository ownership not verified");
  }

  const scan = await scanRepo.create(projectId, "FULL");

  await enqueue({
    scanId: scan.id,
    targetUrl: resolveBaseUrl(project.domain),
    type: "FULL",
    repoUrl: project.repoUrl,
    githubInstallationId: project.githubInstallationNumericId ?? undefined,
  });

  return scan;
}
