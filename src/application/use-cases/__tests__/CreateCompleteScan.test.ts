import { describe, it, expect, vi, beforeEach } from "vitest";
import { createCompleteScan, CreateCompleteScanError } from "../CreateCompleteScan";
import type { IProjectRepository } from "@/domain/repositories/IProjectRepository";
import type { IScanRepository } from "@/domain/repositories/IScanRepository";
import type { Project } from "@/domain/entities/Project";
import type { Scan } from "@/domain/entities/Scan";

const now = new Date();

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "proj-1",
    type: "WEBSITE",
    name: "My Site",
    domain: "example.com",
    userId: "user-1",
    verified: true,
    verificationToken: "token-abc",
    verificationMethod: "DNS_TXT",
    verifiedAt: now,
    repoUrl: "https://github.com/owner/repo",
    repoVerified: true,
    repoVerificationToken: "repo-token",
    repoVerifiedAt: now,
    createdAt: now,
    ...overrides,
  };
}

function makeScan(): Scan {
  return {
    id: "scan-1",
    projectId: "proj-1",
    status: "PENDING",
    type: "FULL",
    score: null,
    maxScore: null,
    inRanking: false,
    findings: [],
    startedAt: now,
    completedAt: null,
  };
}

function makeProjectRepo(project: Project | null = makeProject()): IProjectRepository {
  return {
    findById: vi.fn().mockResolvedValue(project),
    findByDomainAndUserId: vi.fn(),
    findVerifiedByDomain: vi.fn(),
    findByUserId: vi.fn(),
    create: vi.fn(),
    markDomainVerified: vi.fn(),
    markRepoVerified: vi.fn(),
    deleteUnverifiedByDomain: vi.fn(),
    delete: vi.fn(),
  };
}

function makeScanRepo(scan: Scan = makeScan()): IScanRepository {
  return {
    findById: vi.fn(),
    findByProjectId: vi.fn(),
    findLatestCompletedPerProject: vi.fn(),
    findRanking: vi.fn(),
    create: vi.fn().mockResolvedValue(scan),
    updateStatus: vi.fn(),
    invalidate: vi.fn(),
    complete: vi.fn(),
    updateRanking: vi.fn(),
  };
}

describe("createCompleteScan (FULL scan — WEBSITE with verified repo)", () => {
  const enqueue = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => vi.clearAllMocks());

  it("creates a FULL scan and enqueues the job", async () => {
    const projectRepo = makeProjectRepo();
    const scanRepo = makeScanRepo();

    const scan = await createCompleteScan("proj-1", "user-1", projectRepo, scanRepo, enqueue);

    expect(scanRepo.create).toHaveBeenCalledWith("proj-1", "FULL");
    const jobData = enqueue.mock.calls[0][0] as { type: string; repoUrl: string; targetUrl: string; scanId: string };
    expect(jobData.type).toBe("FULL");
    expect(jobData.repoUrl).toBe("https://github.com/owner/repo");
    expect(jobData.targetUrl).toBe("https://example.com");
    expect(jobData.scanId).toBe("scan-1");
    expect(scan.id).toBe("scan-1");
  });

  it("throws when project not found", async () => {
    await expect(
      createCompleteScan("proj-1", "user-1", makeProjectRepo(null), makeScanRepo(), enqueue)
    ).rejects.toThrow(CreateCompleteScanError);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("throws when user does not own the project", async () => {
    await expect(
      createCompleteScan("proj-1", "user-1", makeProjectRepo(makeProject({ userId: "other" })), makeScanRepo(), enqueue)
    ).rejects.toThrow(CreateCompleteScanError);
  });

  it("throws when domain is not verified", async () => {
    await expect(
      createCompleteScan("proj-1", "user-1", makeProjectRepo(makeProject({ verified: false })), makeScanRepo(), enqueue)
    ).rejects.toThrow(CreateCompleteScanError);
  });

  it("throws when repo is not verified", async () => {
    await expect(
      createCompleteScan("proj-1", "user-1", makeProjectRepo(makeProject({ repoVerified: false, repoUrl: null })), makeScanRepo(), enqueue)
    ).rejects.toThrow(CreateCompleteScanError);
  });

  it("throws for CODE_REPO projects", async () => {
    await expect(
      createCompleteScan("proj-1", "user-1", makeProjectRepo(makeProject({ type: "CODE_REPO", domain: null })), makeScanRepo(), enqueue)
    ).rejects.toThrow(CreateCompleteScanError);
  });

  it("does not enqueue if scan creation fails", async () => {
    const scanRepo = makeScanRepo();
    vi.mocked(scanRepo.create).mockRejectedValue(new Error("DB error"));

    await expect(
      createCompleteScan("proj-1", "user-1", makeProjectRepo(), scanRepo, enqueue)
    ).rejects.toThrow("DB error");
    expect(enqueue).not.toHaveBeenCalled();
  });
});
