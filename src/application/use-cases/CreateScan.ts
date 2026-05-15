import type { IScanRepository } from "@/domain/repositories/IScanRepository";
import type { IProjectRepository } from "@/domain/repositories/IProjectRepository";
import type { Scan } from "@/domain/entities/Scan";

export class CreateScanError extends Error {}

export async function createScan(
  projectId: string,
  requestingUserId: string,
  projectRepo: IProjectRepository,
  scanRepo: IScanRepository,
  enqueue: (scanId: string, targetUrl: string) => Promise<void>
): Promise<Scan> {
  const project = await projectRepo.findById(projectId);

  if (!project) throw new CreateScanError("Project not found");
  if (project.userId !== requestingUserId) throw new CreateScanError("Unauthorized");
  if (project.type !== "WEBSITE") throw new CreateScanError("Passive scan only applies to WEBSITE projects");
  if (!project.verified) throw new CreateScanError("Domain ownership not verified");
  if (!project.domain) throw new CreateScanError("Project has no domain configured");

  const scan = await scanRepo.create(projectId, "PASSIVE");

  const targetUrl = `https://${project.domain}`;
  await enqueue(scan.id, targetUrl);

  return scan;
}
