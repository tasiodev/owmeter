import type { GitHubInstallation } from "@/domain/entities/GitHubInstallation";

export interface IGitHubInstallationRepository {
  findByUserId(userId: string): Promise<GitHubInstallation | null>;
  findByInstallationId(installationId: number): Promise<GitHubInstallation | null>;
  upsert(data: {
    userId: string;
    installationId: number;
    targetType: string;
    targetLogin: string;
  }): Promise<GitHubInstallation>;
  deleteByUserId(userId: string): Promise<void>;
  deleteByInstallationId(installationId: number): Promise<void>;
}
