import type { IGitHubInstallationRepository } from "@/domain/repositories/IGitHubInstallationRepository";
import type { GitHubRepo } from "@/domain/entities/GitHubInstallation";

export async function getAccessibleRepos(
  userId: string,
  installationRepo: IGitHubInstallationRepository,
  listRepos: (installationId: number) => Promise<GitHubRepo[]>
): Promise<GitHubRepo[]> {
  const installation = await installationRepo.findByUserId(userId);
  if (!installation) return [];

  return listRepos(installation.installationId);
}
