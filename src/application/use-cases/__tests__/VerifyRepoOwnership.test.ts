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
    githubInstallationNumericId: null,
    githubRepoFullName: null,
    isPublic: true,
    apiKey: "key-1",
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
    updatePrivacy: vi.fn(),
    markDomainVerified: vi.fn(),
    markRepoVerified: vi.fn().mockImplementation((_id, repoUrl) =>
      Promise.resolve({ ...makeProject(), repoVerified: true, repoUrl, repoVerifiedAt: new Date() })
    ),
    findByApiKey: vi.fn(),
    regenerateApiKey: vi.fn(),
    deleteUnverifiedByDomain: vi.fn(),
    delete: vi.fn(),
    linkPrivateRepo: vi.fn(),
    clearPrivateReposByInstallation: vi.fn(),
  };
}

function stubFetch(ok: boolean, body = "owmeter-verify=REPO-TOKEN-XYZ") {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok, text: async () => body })
  );
}

describe("verifyRepoOwnership — access control", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it("throws when project not found", async () => {
    await expect(
      verifyRepoOwnership("proj-1", "user-1", "https://github.com/owner/repo", makeRepo(null))
    ).rejects.toThrow(RepoVerificationError);
  });

  it("throws when user does not own the project", async () => {
    await expect(
      verifyRepoOwnership("proj-1", "user-1", "https://github.com/owner/repo", makeRepo(makeProject({ userId: "other" })))
    ).rejects.toThrow(RepoVerificationError);
  });

  it("returns project immediately if already repo-verified", async () => {
    const verified = makeProject({ repoVerified: true, repoUrl: "https://github.com/owner/repo" });
    const repo = makeRepo(verified);
    const result = await verifyRepoOwnership("proj-1", "user-1", "https://github.com/owner/repo", repo);
    expect(result.repoVerified).toBe(true);
    expect(repo.markRepoVerified).not.toHaveBeenCalled();
  });

  it("throws for unsupported host", async () => {
    await expect(
      verifyRepoOwnership("proj-1", "user-1", "https://codeberg.org/owner/repo", makeRepo())
    ).rejects.toThrow(RepoVerificationError);
  });
});

describe("verifyRepoOwnership — GitHub", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it("marks verified when .owmeter has correct token", async () => {
    const repo = makeRepo();
    stubFetch(true);
    const result = await verifyRepoOwnership("proj-1", "user-1", "https://github.com/owner/my-lib", repo);
    expect(result.repoVerified).toBe(true);
    expect(repo.markRepoVerified).toHaveBeenCalledWith("proj-1", "https://github.com/owner/my-lib");
  });

  it("throws when file has wrong content", async () => {
    stubFetch(true, "owmeter-verify=WRONG");
    await expect(
      verifyRepoOwnership("proj-1", "user-1", "https://github.com/owner/repo", makeRepo())
    ).rejects.toThrow(RepoVerificationError);
  });

  it("throws when file not found (404)", async () => {
    stubFetch(false);
    await expect(
      verifyRepoOwnership("proj-1", "user-1", "https://github.com/owner/repo", makeRepo())
    ).rejects.toThrow(RepoVerificationError);
  });

  it("tries both main and master branches", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true, text: async () => "owmeter-verify=REPO-TOKEN-XYZ" });
    vi.stubGlobal("fetch", fetchMock);

    const result = await verifyRepoOwnership("proj-1", "user-1", "https://github.com/owner/repo", makeRepo());
    expect(result.repoVerified).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("verifyRepoOwnership — GitLab", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it("marks verified for a gitlab.com repo", async () => {
    const repo = makeRepo();
    stubFetch(true);
    const result = await verifyRepoOwnership("proj-1", "user-1", "https://gitlab.com/owner/my-lib", repo);
    expect(result.repoVerified).toBe(true);
    expect(repo.markRepoVerified).toHaveBeenCalledWith("proj-1", "https://gitlab.com/owner/my-lib");
  });

  it("marks verified for a nested namespace", async () => {
    stubFetch(true);
    const result = await verifyRepoOwnership("proj-1", "user-1", "https://gitlab.com/group/subgroup/repo", makeRepo());
    expect(result.repoVerified).toBe(true);
  });

  it("uses /-/raw/ URL pattern for the verification fetch", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "owmeter-verify=REPO-TOKEN-XYZ",
    });
    vi.stubGlobal("fetch", fetchMock);

    await verifyRepoOwnership("proj-1", "user-1", "https://gitlab.com/owner/repo", makeRepo());

    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain("gitlab.com/owner/repo/-/raw/");
  });
});

describe("verifyRepoOwnership — Bitbucket", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it("marks verified for a bitbucket.org repo", async () => {
    const repo = makeRepo();
    stubFetch(true);
    const result = await verifyRepoOwnership("proj-1", "user-1", "https://bitbucket.org/owner/my-lib", repo);
    expect(result.repoVerified).toBe(true);
    expect(repo.markRepoVerified).toHaveBeenCalledWith("proj-1", "https://bitbucket.org/owner/my-lib");
  });

  it("uses /raw/ URL pattern for the verification fetch", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "owmeter-verify=REPO-TOKEN-XYZ",
    });
    vi.stubGlobal("fetch", fetchMock);

    await verifyRepoOwnership("proj-1", "user-1", "https://bitbucket.org/owner/repo", makeRepo());

    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain("bitbucket.org/owner/repo/raw/");
  });
});
