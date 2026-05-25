import type { IGitHubInstallationRepository } from "@/domain/repositories/IGitHubInstallationRepository";
import type { GitHubInstallation } from "@/domain/entities/GitHubInstallation";

export class ConnectGitHubInstallationError extends Error {}

export async function connectGitHubInstallation(
  userId: string,
  installationId: number,
  getInstallationInfo: (
    id: number
  ) => Promise<{ targetLogin: string; targetType: string }>,
  repo: IGitHubInstallationRepository
): Promise<GitHubInstallation> {
  if (!userId) throw new ConnectGitHubInstallationError("User not authenticated");
  if (!installationId || installationId <= 0) {
    throw new ConnectGitHubInstallationError("Invalid installation ID");
  }

  const info = await getInstallationInfo(installationId);

  return repo.upsert({
    userId,
    installationId,
    targetType: info.targetType,
    targetLogin: info.targetLogin,
  });
}
