import type { Project, VerificationMethod } from "../entities/Project";

export interface IProjectRepository {
  findById(id: string): Promise<Project | null>;
  findByDomainAndUserId(domain: string, userId: string): Promise<Project | null>;
  findVerifiedByDomain(domain: string): Promise<Project | null>;
  findByUserId(userId: string): Promise<Project[]>;
  create(data: { type: Project["type"]; name: string; domain?: string; userId: string; isPublic?: boolean }): Promise<Project>;
  updatePrivacy(id: string, isPublic: boolean): Promise<Project>;
  markDomainVerified(id: string, method: VerificationMethod): Promise<Project>;
  markRepoVerified(id: string, repoUrl: string): Promise<Project>;
  findByApiKey(apiKey: string): Promise<Project | null>;
  regenerateApiKey(id: string): Promise<string>;
  deleteUnverifiedByDomain(domain: string, excludeUserId: string): Promise<void>;
  delete(id: string): Promise<void>;
  linkPrivateRepo(
    id: string,
    repoUrl: string,
    installationNumericId: number,
    githubRepoFullName: string
  ): Promise<Project>;
  clearPrivateReposByInstallation(installationNumericId: number): Promise<void>;
}
