import type { IProjectRepository } from "@/domain/repositories/IProjectRepository";
import type { Project, ProjectType, VerificationMethod } from "@/domain/entities/Project";
import { prisma } from "../prisma";

type DbProject = {
  id: string;
  type: string;
  name: string;
  userId: string;
  domain: string | null;
  verified: boolean;
  verificationToken: string;
  verificationMethod: string | null;
  verifiedAt: Date | null;
  repoUrl: string | null;
  repoVerified: boolean;
  repoVerificationToken: string | null;
  repoVerifiedAt: Date | null;
  githubInstallationNumericId: number | null;
  githubRepoFullName: string | null;
  isPublic: boolean;
  apiKey: string;
  createdAt: Date;
};

function toEntity(r: DbProject): Project {
  return {
    ...r,
    type: r.type as ProjectType,
    verificationMethod: r.verificationMethod as VerificationMethod | null,
  };
}

export class PrismaProjectRepository implements IProjectRepository {
  async findById(id: string): Promise<Project | null> {
    const r = await prisma.project.findUnique({ where: { id } });
    return r ? toEntity(r) : null;
  }

  async findByDomainAndUserId(domain: string, userId: string): Promise<Project | null> {
    const r = await prisma.project.findUnique({ where: { domain_userId: { domain, userId } } });
    return r ? toEntity(r) : null;
  }

  async findVerifiedByDomain(domain: string): Promise<Project | null> {
    const r = await prisma.project.findFirst({ where: { domain, verified: true } });
    return r ? toEntity(r) : null;
  }

  async findByUserId(userId: string): Promise<Project[]> {
    const records = await prisma.project.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    return records.map(toEntity);
  }

  async create(data: { type: Project["type"]; name: string; domain?: string; userId: string; isPublic?: boolean }): Promise<Project> {
    const r = await prisma.project.create({
      data: {
        type: data.type,
        name: data.name,
        domain: data.domain ?? null,
        userId: data.userId,
        isPublic: data.isPublic ?? true,
      },
    });
    return toEntity(r);
  }

  async updatePrivacy(id: string, isPublic: boolean): Promise<Project> {
    const r = await prisma.project.update({ where: { id }, data: { isPublic } });
    return toEntity(r);
  }

  async markDomainVerified(id: string, method: VerificationMethod): Promise<Project> {
    const r = await prisma.project.update({
      where: { id },
      data: { verified: true, verificationMethod: method, verifiedAt: new Date() },
    });
    return toEntity(r);
  }

  async markRepoVerified(id: string, repoUrl: string): Promise<Project> {
    const r = await prisma.project.update({
      where: { id },
      data: { repoUrl, repoVerified: true, repoVerifiedAt: new Date() },
    });
    return toEntity(r);
  }

  async findByApiKey(apiKey: string): Promise<Project | null> {
    const r = await prisma.project.findUnique({ where: { apiKey } });
    return r ? toEntity(r) : null;
  }

  async regenerateApiKey(id: string): Promise<string> {
    const newKey = crypto.randomUUID();
    await prisma.project.update({ where: { id }, data: { apiKey: newKey } });
    return newKey;
  }

  async deleteUnverifiedByDomain(domain: string, excludeUserId: string): Promise<void> {
    await prisma.project.deleteMany({
      where: { domain, verified: false, userId: { not: excludeUserId } },
    });
  }

  async delete(id: string): Promise<void> {
    await prisma.project.delete({ where: { id } });
  }

  async linkPrivateRepo(
    id: string,
    repoUrl: string,
    installationNumericId: number,
    githubRepoFullName: string
  ): Promise<Project> {
    const r = await prisma.project.update({
      where: { id },
      data: {
        repoUrl,
        repoVerified: true,
        repoVerifiedAt: new Date(),
        githubInstallationNumericId: installationNumericId,
        githubRepoFullName,
      },
    });
    return toEntity(r);
  }

  async clearPrivateReposByInstallation(installationNumericId: number): Promise<void> {
    await prisma.project.updateMany({
      where: { githubInstallationNumericId: installationNumericId },
      data: {
        repoVerified: false,
        repoVerifiedAt: null,
        githubInstallationNumericId: null,
        githubRepoFullName: null,
      },
    });
  }
}
