import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { verifyRepoOwnership, RepoVerificationError } from "../VerifyRepoOwnership";
import type { IProjectRepository } from "@/domain/repositories/IProjectRepository";
import type { Project } from "@/domain/entities/Project";

const now = new Date();

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "proj-1",
    type: "CODE_REPO",
    name: "My Lib",
    domain: null,
    userId: "user-1",
    verified: false,
    verificationToken: "domain-token",
    verificationMethod: null,
    verifiedAt: null,
    repoUrl: null,
    repoVerified: false,
    repoVerificationToken: "REPO-TOKEN-XYZ",
    repoVerifiedAt: null,
    createdAt: now,
    ...overrides,
  };
}

function makeRepo(project: Project | null = makeProject()): IProjectRepository {
  return {
    findById: vi.fn().mockResolvedValue(project),
    findByDomainAndUserId: vi.fn(),
    findVerifiedByDomain: vi.fn(),
    findByUserId: vi.fn(),
    create: vi.fn(),
    markDomainVerified: vi.fn(),
    markRepoVerified: vi.fn().mockImplementation((_id, repoUrl) =>
      Promise.resolve({ ...makeProject(), repoVerified: true, repoUrl, repoVerifiedAt: new Date() })
    ),
    deleteUnverifiedByDomain: vi.fn(),
    delete: vi.fn(),
  };
}

const VALID_REPO_URL = "https://github.com/owner/my-lib";

describe("verifyRepoOwnership", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it("throws RepoVerificationError when project not found", async () => {
    const repo = makeRepo(null);
    await expect(verifyRepoOwnership("proj-1", "user-1", VALID_REPO_URL, repo)).rejects.toThrow(
      RepoVerificationError
    );
  });

  it("throws RepoVerificationError when user does not own the project", async () => {
    const repo = makeRepo(makeProject({ userId: "other" }));
    await expect(verifyRepoOwnership("proj-1", "user-1", VALID_REPO_URL, repo)).rejects.toThrow(
      RepoVerificationError
    );
  });

  it("throws RepoVerificationError for invalid GitHub URL", async () => {
    const repo = makeRepo();
    await expect(
      verifyRepoOwnership("proj-1", "user-1", "https://gitlab.com/owner/repo", repo)
    ).rejects.toThrow(RepoVerificationError);
  });

  it("returns the project immediately if already repo-verified", async () => {
    const verified = makeProject({ repoVerified: true, repoUrl: VALID_REPO_URL });
    const repo = makeRepo(verified);
    const result = await verifyRepoOwnership("proj-1", "user-1", VALID_REPO_URL, repo);
    expect(result.repoVerified).toBe(true);
    expect(repo.markRepoVerified).not.toHaveBeenCalled();
  });

  it("marks repo verified when .owaspchecker file contains the correct token", async () => {
    const repo = makeRepo();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => "owaspchecker-verify=REPO-TOKEN-XYZ",
      })
    );

    const result = await verifyRepoOwnership("proj-1", "user-1", VALID_REPO_URL, repo);
    expect(result.repoVerified).toBe(true);
    expect(repo.markRepoVerified).toHaveBeenCalledWith("proj-1", VALID_REPO_URL);
  });

  it("throws RepoVerificationError when file has wrong content", async () => {
    const repo = makeRepo();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => "owaspchecker-verify=WRONG-TOKEN",
      })
    );

    await expect(verifyRepoOwnership("proj-1", "user-1", VALID_REPO_URL, repo)).rejects.toThrow(
      RepoVerificationError
    );
  });

  it("throws RepoVerificationError when file not found (404)", async () => {
    const repo = makeRepo();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

    await expect(verifyRepoOwnership("proj-1", "user-1", VALID_REPO_URL, repo)).rejects.toThrow(
      RepoVerificationError
    );
  });

  it("tries both main and master branches", async () => {
    const repo = makeRepo();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false }) // main fails
      .mockResolvedValueOnce({ ok: true, text: async () => "owaspchecker-verify=REPO-TOKEN-XYZ" }); // master succeeds
    vi.stubGlobal("fetch", fetchMock);

    const result = await verifyRepoOwnership("proj-1", "user-1", VALID_REPO_URL, repo);
    expect(result.repoVerified).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
