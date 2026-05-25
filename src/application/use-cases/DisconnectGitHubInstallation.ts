import type { IGitHubInstallationRepository } from "@/domain/repositories/IGitHubInstallationRepository";
import type { IProjectRepository } from "@/domain/repositories/IProjectRepository";

export class DisconnectGitHubInstallationError extends Error {}

export async function disconnectGitHubInstallation(
  userId: string,
  installationRepo: IGitHubInstallationRepository,
  projectRepo: IProjectRepository
): Promise<void> {
  const installation = await installationRepo.findByUserId(userId);
  if (!installation) return; // already disconnected, no-op

  // Reset repoVerified on all projects that were linked via this installation
  await projectRepo.clearPrivateReposByInstallation(installation.installationId);

  // Delete the installation record (GitHub App is disconnected)
  await installationRepo.deleteByUserId(userId);
}
