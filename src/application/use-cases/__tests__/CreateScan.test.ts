import { describe, it, expect, vi, beforeEach } from "vitest";
import { createScan, CreateScanError } from "../CreateScan";
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
    repoUrl: null,
    repoVerified: false,
    repoVerificationToken: "repo-token",
    repoVerifiedAt: null,
    createdAt: now,
    ...overrides,
  };
}

function makeScan(): Scan {
  return {
    id: "scan-1",
    projectId: "proj-1",
    status: "PENDING",
    type: "PASSIVE",
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
    updateScore: vi.fn(),
  };
}

describe("createScan", () => {
  const enqueue = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => vi.clearAllMocks());

  it("creates a PASSIVE scan and enqueues the job for a verified WEBSITE", async () => {
    const projectRepo = makeProjectRepo();
    const scanRepo = makeScanRepo();

    const scan = await createScan("proj-1", "user-1", projectRepo, scanRepo, enqueue);

    expect(scanRepo.create).toHaveBeenCalledWith("proj-1", "PASSIVE");
    expect(enqueue).toHaveBeenCalledWith("scan-1", "https://example.com");
    expect(scan.id).toBe("scan-1");
  });

  it("throws CreateScanError when project not found", async () => {
    const projectRepo = makeProjectRepo(null);
    const scanRepo = makeScanRepo();

    await expect(createScan("proj-1", "user-1", projectRepo, scanRepo, enqueue)).rejects.toThrow(
      CreateScanError
    );
    expect(scanRepo.create).not.toHaveBeenCalled();
  });

  it("throws CreateScanError when user does not own the project", async () => {
    const projectRepo = makeProjectRepo(makeProject({ userId: "other-user" }));
    const scanRepo = makeScanRepo();

    await expect(createScan("proj-1", "user-1", projectRepo, scanRepo, enqueue)).rejects.toThrow(
      CreateScanError
    );
  });

  it("throws CreateScanError when project is not verified", async () => {
    const projectRepo = makeProjectRepo(makeProject({ verified: false }));
    const scanRepo = makeScanRepo();

    await expect(createScan("proj-1", "user-1", projectRepo, scanRepo, enqueue)).rejects.toThrow(
      CreateScanError
    );
  });

  it("throws CreateScanError for CODE_REPO projects", async () => {
    const projectRepo = makeProjectRepo(makeProject({ type: "CODE_REPO", domain: null }));
    const scanRepo = makeScanRepo();

    await expect(createScan("proj-1", "user-1", projectRepo, scanRepo, enqueue)).rejects.toThrow(
      CreateScanError
    );
  });

  it("does not enqueue if scan creation fails", async () => {
    const projectRepo = makeProjectRepo();
    const scanRepo = makeScanRepo();
    vi.mocked(scanRepo.create).mockRejectedValue(new Error("DB error"));

    await expect(createScan("proj-1", "user-1", projectRepo, scanRepo, enqueue)).rejects.toThrow(
      "DB error"
    );
    expect(enqueue).not.toHaveBeenCalled();
  });
});
