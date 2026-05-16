import type { IScanRepository } from "@/domain/repositories/IScanRepository";
import type { IProjectRepository } from "@/domain/repositories/IProjectRepository";
import type { Scan } from "@/domain/entities/Scan";

export type CodeScanJobData = {
  scanId: string;
  type: "CODE";
  repoUrl: string;
};

export class CreateCodeScanError extends Error {}

export async function createCodeScan(
  projectId: string,
  requestingUserId: string,
  projectRepo: IProjectRepository,
  scanRepo: IScanRepository,
  enqueue: (jobData: CodeScanJobData) => Promise<void>
): Promise<Scan> {
  const project = await projectRepo.findById(projectId);

  if (!project) throw new CreateCodeScanError("Project not found");
  if (project.userId !== requestingUserId) throw new CreateCodeScanError("Unauthorized");
  if (project.type !== "CODE_REPO") throw new CreateCodeScanError("Code scan only applies to CODE_REPO projects");
  if (!project.repoVerified || !project.repoUrl) {
    throw new CreateCodeScanError("Repository ownership not verified");
  }

  const scan = await scanRepo.create(projectId, "CODE");

  await enqueue({
    scanId: scan.id,
    type: "CODE",
    repoUrl: project.repoUrl,
  });

  return scan;
}
