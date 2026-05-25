import { describe, it, expect, vi, beforeEach } from "vitest";
import { disconnectGitHubInstallation } from "../DisconnectGitHubInstallation";
import type { IGitHubInstallationRepository } from "@/domain/repositories/IGitHubInstallationRepository";
import type { IProjectRepository } from "@/domain/repositories/IProjectRepository";
import type { GitHubInstallation } from "@/domain/entities/GitHubInstallation";

const now = new Date();

function makeInstallation(overrides: Partial<GitHubInstallation> = {}): GitHubInstallation {
  return {
    id: "inst-1",
    userId: "user-1",
    installationId: 99,
    targetType: "User",
    targetLogin: "octocat",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeInstallationRepo(installation: GitHubInstallation | null = makeInstallation()): IGitHubInstallationRepository {
  return {
    findByUserId: vi.fn().mockResolvedValue(installation),
    findByInstallationId: vi.fn(),
    upsert: vi.fn(),
    deleteByUserId: vi.fn().mockResolvedValue(undefined),
    deleteByInstallationId: vi.fn(),
  };
}

function makeProjectRepo(): IProjectRepository {
  return {
    findById: vi.fn(),
    findByDomainAndUserId: vi.fn(),
    findVerifiedByDomain: vi.fn(),
    findByUserId: vi.fn(),
    create: vi.fn(),
    updatePrivacy: vi.fn(),
    markDomainVerified: vi.fn(),
    markRepoVerified: vi.fn(),
    findByApiKey: vi.fn(),
    regenerateApiKey: vi.fn(),
    deleteUnverifiedByDomain: vi.fn(),
    delete: vi.fn(),
    linkPrivateRepo: vi.fn(),
    clearPrivateReposByInstallation: vi.fn().mockResolvedValue(undefined),
  };
}

describe("disconnectGitHubInstallation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("is a no-op when no installation is found for the user", async () => {
    const installationRepo = makeInstallationRepo(null);
    const projectRepo = makeProjectRepo();

    await disconnectGitHubInstallation("user-1", installationRepo, projectRepo);

    expect(projectRepo.clearPrivateReposByInstallation).not.toHaveBeenCalled();
    expect(installationRepo.deleteByUserId).not.toHaveBeenCalled();
  });

  it("clears linked project repos before deleting the installation record", async () => {
    const callOrder: string[] = [];
    const installationRepo = makeInstallationRepo();
    const projectRepo = makeProjectRepo();

    (projectRepo.clearPrivateReposByInstallation as ReturnType<typeof vi.fn>).mockImplementation(
      () => { callOrder.push("clear"); return Promise.resolve(); }
    );
    (installationRepo.deleteByUserId as ReturnType<typeof vi.fn>).mockImplementation(
      () => { callOrder.push("delete"); return Promise.resolve(); }
    );

    await disconnectGitHubInstallation("user-1", installationRepo, projectRepo);

    expect(callOrder).toEqual(["clear", "delete"]);
  });

  it("passes the numeric installationId (not the record id) to clearPrivateReposByInstallation", async () => {
    const installation = makeInstallation({ installationId: 99 });
    const installationRepo = makeInstallationRepo(installation);
    const projectRepo = makeProjectRepo();

    await disconnectGitHubInstallation("user-1", installationRepo, projectRepo);

    expect(projectRepo.clearPrivateReposByInstallation).toHaveBeenCalledWith(99);
  });

  it("deletes the installation record by userId", async () => {
    const installationRepo = makeInstallationRepo();
    const projectRepo = makeProjectRepo();

    await disconnectGitHubInstallation("user-1", installationRepo, projectRepo);

    expect(installationRepo.deleteByUserId).toHaveBeenCalledWith("user-1");
  });

  it("looks up the installation by the requesting userId", async () => {
    const installationRepo = makeInstallationRepo();
    const projectRepo = makeProjectRepo();

    await disconnectGitHubInstallation("user-42", installationRepo, projectRepo);

    expect(installationRepo.findByUserId).toHaveBeenCalledWith("user-42");
  });
});
