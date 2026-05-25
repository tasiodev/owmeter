import { describe, it, expect, vi, beforeEach } from "vitest";
import { linkPrivateRepo, LinkPrivateRepoError } from "../LinkPrivateRepo";
import type { IProjectRepository } from "@/domain/repositories/IProjectRepository";
import type { IGitHubInstallationRepository } from "@/domain/repositories/IGitHubInstallationRepository";
import type { Project } from "@/domain/entities/Project";
import type { GitHubInstallation } from "@/domain/entities/GitHubInstallation";

const now = new Date();

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "proj-1",
    type: "CODE_REPO",
    name: "My Repo",
    domain: null,
    userId: "user-1",
    verified: false,
    verificationToken: null,
    verificationMethod: null,
    verifiedAt: null,
    repoUrl: null,
    repoVerified: false,
    repoVerificationToken: "token-abc",
    repoVerifiedAt: null,
    githubInstallationNumericId: null,
    githubRepoFullName: null,
    isPublic: false,
    apiKey: "key-1",
    createdAt: now,
    ...overrides,
  };
}

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

function makeProjectRepo(project: Project | null = makeProject()): IProjectRepository {
  return {
    findById: vi.fn().mockResolvedValue(project),
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
    linkPrivateRepo: vi.fn().mockImplementation((_id, repoUrl, installationId, repoFullName) =>
      Promise.resolve(makeProject({ repoUrl, githubInstallationNumericId: installationId, githubRepoFullName: repoFullName, repoVerified: true }))
    ),
    clearPrivateReposByInstallation: vi.fn(),
  };
}

function makeInstallationRepo(installation: GitHubInstallation | null = makeInstallation()): IGitHubInstallationRepository {
  return {
    findByUserId: vi.fn().mockResolvedValue(installation),
    findByInstallationId: vi.fn(),
    upsert: vi.fn(),
    deleteByUserId: vi.fn(),
    deleteByInstallationId: vi.fn(),
  };
}

const verifyRepoAccess = vi.fn();

describe("linkPrivateRepo", () => {
  beforeEach(() => vi.clearAllMocks());

  // ── Format validation ─────────────────────────────────────────────────────

  it("throws LinkPrivateRepoError for invalid repo format (no slash)", async () => {
    await expect(
      linkPrivateRepo("proj-1", "user-1", "noslash", makeProjectRepo(), makeInstallationRepo(), verifyRepoAccess)
    ).rejects.toThrow(LinkPrivateRepoError);
    expect(verifyRepoAccess).not.toHaveBeenCalled();
  });

  it("throws LinkPrivateRepoError for empty string", async () => {
    await expect(
      linkPrivateRepo("proj-1", "user-1", "", makeProjectRepo(), makeInstallationRepo(), verifyRepoAccess)
    ).rejects.toThrow(LinkPrivateRepoError);
  });

  it("throws LinkPrivateRepoError for path with three segments", async () => {
    await expect(
      linkPrivateRepo("proj-1", "user-1", "a/b/c", makeProjectRepo(), makeInstallationRepo(), verifyRepoAccess)
    ).rejects.toThrow(LinkPrivateRepoError);
  });

  // ── Project checks ────────────────────────────────────────────────────────

  it("throws LinkPrivateRepoError when project does not exist", async () => {
    const projectRepo = makeProjectRepo(null);
    await expect(
      linkPrivateRepo("ghost", "user-1", "owner/repo", projectRepo, makeInstallationRepo(), verifyRepoAccess)
    ).rejects.toThrow(LinkPrivateRepoError);
  });

  it("throws LinkPrivateRepoError when project belongs to a different user (cross-user security)", async () => {
    const projectRepo = makeProjectRepo(makeProject({ userId: "other-user" }));
    await expect(
      linkPrivateRepo("proj-1", "user-1", "owner/repo", projectRepo, makeInstallationRepo(), verifyRepoAccess)
    ).rejects.toThrow(LinkPrivateRepoError);
    // Verify we never reached the installation or repo-access checks
    expect(verifyRepoAccess).not.toHaveBeenCalled();
  });

  // ── Installation checks ───────────────────────────────────────────────────

  it("throws LinkPrivateRepoError when no GitHub App is connected for this user", async () => {
    const installationRepo = makeInstallationRepo(null);
    await expect(
      linkPrivateRepo("proj-1", "user-1", "owner/repo", makeProjectRepo(), installationRepo, verifyRepoAccess)
    ).rejects.toThrow(LinkPrivateRepoError);
    expect(verifyRepoAccess).not.toHaveBeenCalled();
  });

  it("throws LinkPrivateRepoError when repo is not accessible via the installation", async () => {
    verifyRepoAccess.mockResolvedValue(false);
    await expect(
      linkPrivateRepo("proj-1", "user-1", "owner/private-repo", makeProjectRepo(), makeInstallationRepo(), verifyRepoAccess)
    ).rejects.toThrow(LinkPrivateRepoError);
    expect(verifyRepoAccess).toHaveBeenCalledWith(99, "owner/private-repo");
  });

  // ── Happy path ────────────────────────────────────────────────────────────

  it("links the repo when all checks pass", async () => {
    verifyRepoAccess.mockResolvedValue(true);
    const projectRepo = makeProjectRepo();
    const installationRepo = makeInstallationRepo();

    const result = await linkPrivateRepo(
      "proj-1",
      "user-1",
      "owner/my-private-repo",
      projectRepo,
      installationRepo,
      verifyRepoAccess
    );

    expect(verifyRepoAccess).toHaveBeenCalledWith(99, "owner/my-private-repo");
    expect(projectRepo.linkPrivateRepo).toHaveBeenCalledWith(
      "proj-1",
      "https://github.com/owner/my-private-repo",
      99,
      "owner/my-private-repo"
    );
    expect(result.githubRepoFullName).toBe("owner/my-private-repo");
    expect(result.repoVerified).toBe(true);
  });

  it("uses the installation belonging to the requesting user, not any other user's", async () => {
    // User-1 has installation 99, user-2 has installation 200.
    // Linking a project for user-1 must use installation 99 only.
    verifyRepoAccess.mockResolvedValue(true);
    const installationRepo = makeInstallationRepo(makeInstallation({ installationId: 99, userId: "user-1" }));

    await linkPrivateRepo("proj-1", "user-1", "owner/repo", makeProjectRepo(), installationRepo, verifyRepoAccess);

    expect(installationRepo.findByUserId).toHaveBeenCalledWith("user-1");
    expect(verifyRepoAccess).toHaveBeenCalledWith(99, "owner/repo");
  });
});
