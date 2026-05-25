import type { IGitHubInstallationRepository } from "@/domain/repositories/IGitHubInstallationRepository";
import type { GitHubInstallation } from "@/domain/entities/GitHubInstallation";
import { prisma } from "../prisma";

function toEntity(r: {
  id: string;
  userId: string;
  installationId: number;
  targetType: string;
  targetLogin: string;
  createdAt: Date;
  updatedAt: Date;
}): GitHubInstallation {
  return { ...r };
}

export class PrismaGitHubInstallationRepository
  implements IGitHubInstallationRepository
{
  async findByUserId(userId: string): Promise<GitHubInstallation | null> {
    const r = await prisma.gitHubInstallation.findUnique({ where: { userId } });
    return r ? toEntity(r) : null;
  }

  async findByInstallationId(
    installationId: number
  ): Promise<GitHubInstallation | null> {
    const r = await prisma.gitHubInstallation.findUnique({
      where: { installationId },
    });
    return r ? toEntity(r) : null;
  }

  async upsert(data: {
    userId: string;
    installationId: number;
    targetType: string;
    targetLogin: string;
  }): Promise<GitHubInstallation> {
    const r = await prisma.gitHubInstallation.upsert({
      where: { userId: data.userId },
      create: data,
      update: {
        installationId: data.installationId,
        targetType: data.targetType,
        targetLogin: data.targetLogin,
      },
    });
    return toEntity(r);
  }

  async deleteByUserId(userId: string): Promise<void> {
    await prisma.gitHubInstallation.deleteMany({ where: { userId } });
  }

  async deleteByInstallationId(installationId: number): Promise<void> {
    await prisma.gitHubInstallation.deleteMany({ where: { installationId } });
  }
}
