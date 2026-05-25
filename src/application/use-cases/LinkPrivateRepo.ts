import type { IGitHubInstallationRepository } from "@/domain/repositories/IGitHubInstallationRepository";
import type { IProjectRepository } from "@/domain/repositories/IProjectRepository";
import type { Project } from "@/domain/entities/Project";

export class LinkPrivateRepoError extends Error {}

const REPO_FULL_NAME_RE = /^[\w.-]+\/[\w.-]+$/;

export async function linkPrivateRepo(
  projectId: string,
  requestingUserId: string,
  repoFullName: string,
  projectRepo: IProjectRepository,
  installationRepo: IGitHubInstallationRepository,
  verifyRepoAccess: (installationId: number, repoFullName: string) => Promise<boolean>
): Promise<Project> {
  // Validate repo name format (owner/repo)
  if (!REPO_FULL_NAME_RE.test(repoFullName)) {
    throw new LinkPrivateRepoError("Invalid repository name format. Expected: owner/repo");
  }

  // Verify the project exists and belongs to the requesting user
  const project = await projectRepo.findById(projectId);
  if (!project) throw new LinkPrivateRepoError("Project not found");
  if (project.userId !== requestingUserId) throw new LinkPrivateRepoError("Unauthorized");

  // Verify the user has a GitHub App installation
  const installation = await installationRepo.findByUserId(requestingUserId);
  if (!installation) {
    throw new LinkPrivateRepoError(
      "GitHub App not connected. Connect it first from Settings."
    );
  }

  // Verify the repo is actually accessible via this installation (security check)
  const hasAccess = await verifyRepoAccess(installation.installationId, repoFullName);
  if (!hasAccess) {
    throw new LinkPrivateRepoError(
      "Repository not accessible. Make sure the GitHub App has been granted access to it."
    );
  }

  const repoUrl = `https://github.com/${repoFullName}`;

  return projectRepo.linkPrivateRepo(
    projectId,
    repoUrl,
    installation.installationId,
    repoFullName
  );
}
