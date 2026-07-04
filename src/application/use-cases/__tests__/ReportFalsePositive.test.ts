import { describe, it, expect, vi, beforeEach } from "vitest";
import { reportFalsePositive, ReportFalsePositiveError } from "../ReportFalsePositive";
import type { IProjectRepository } from "@/domain/repositories/IProjectRepository";
import type { IFalsePositiveReportRepository } from "@/domain/repositories/IFalsePositiveReportRepository";
import type { Project } from "@/domain/entities/Project";
import type { FalsePositiveReport } from "@/domain/entities/FalsePositiveReport";

const now = new Date();

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "proj-1",
    type: "WEBSITE",
    name: "My Site",
    domain: "example.com",
    userId: "user-1",
    verified: true,
    verificationToken: "token",
    verificationMethod: "DNS_TXT",
    verifiedAt: now,
    repoUrl: null,
    repoVerified: false,
    repoVerificationToken: "repo-token",
    repoVerifiedAt: null,
    githubInstallationNumericId: null,
    githubRepoFullName: null,
    isPublic: false,
    apiKey: "key-abc",
    createdAt: now,
    ...overrides,
  };
}

function makeReport(overrides: Partial<FalsePositiveReport> = {}): FalsePositiveReport {
  return {
    id: "fp-1",
    projectId: "proj-1",
    reportedById: "user-1",
    category: "A05_INJECTION",
    title: "SQL Injection",
    filePath: "src/db.ts",
    evidence: "src/db.ts:42 — query = `SELECT * FROM ${table}`",
    reason: "This is a test helper, not production code.",
    status: "PENDING",
    reviewedById: null,
    reviewedAt: null,
    adminNote: null,
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
    markDomainVerified: vi.fn(),
    markRepoVerified: vi.fn(),
    deleteUnverifiedByDomain: vi.fn(),
    delete: vi.fn(),
  } as unknown as IProjectRepository;
}

function makeFpRepo(existing: FalsePositiveReport | null = null): IFalsePositiveReportRepository {
  return {
    findByProject: vi.fn(),
    findApprovedByProject: vi.fn(),
    findAll: vi.fn(),
    findAllWithDetails: vi.fn(),
    findById: vi.fn(),
    findExisting: vi.fn().mockResolvedValue(existing),
    create: vi.fn().mockResolvedValue(makeReport()),
    updateStatus: vi.fn(),
  };
}

describe("reportFalsePositive", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a report when the user owns the project and no duplicate exists", async () => {
    const projectRepo = makeProjectRepo();
    const fpRepo = makeFpRepo(null);

    const result = await reportFalsePositive(
      "proj-1",
      "user-1",
      "A05_INJECTION",
      "SQL Injection",
      "src/db.ts:42 — query = `SELECT * FROM ${table}`",
      "This is a test helper, not production code.",
      projectRepo,
      fpRepo
    );

    expect(fpRepo.create).toHaveBeenCalledOnce();
    expect(result.projectId).toBe("proj-1");
    expect(result.status).toBe("PENDING");
  });

  it("extracts the filePath from the evidence and passes it to create()", async () => {
    const projectRepo = makeProjectRepo();
    const fpRepo = makeFpRepo(null);

    await reportFalsePositive(
      "proj-1",
      "user-1",
      "A05_INJECTION",
      "SQL Injection",
      "src/db.ts:42 — query snippet",
      "reason",
      projectRepo,
      fpRepo
    );

    expect(fpRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ filePath: "src/db.ts" })
    );
  });

  it("stores empty filePath when evidence has no file:line pattern (passive finding)", async () => {
    const projectRepo = makeProjectRepo();
    const fpRepo = makeFpRepo(null);

    await reportFalsePositive(
      "proj-1",
      "user-1",
      "A02_SECURITY_MISCONFIGURATION",
      "Missing CSP",
      "Header X-Content-Type-Options is absent",
      "reason",
      projectRepo,
      fpRepo
    );

    expect(fpRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ filePath: "" })
    );
  });

  it("throws ReportFalsePositiveError when project is not found", async () => {
    const projectRepo = makeProjectRepo(null);
    const fpRepo = makeFpRepo();

    await expect(
      reportFalsePositive("proj-1", "user-1", "A05_INJECTION", "title", "evidence", "reason", projectRepo, fpRepo)
    ).rejects.toThrow(ReportFalsePositiveError);

    expect(fpRepo.create).not.toHaveBeenCalled();
  });

  it("throws ReportFalsePositiveError when user does not own the project", async () => {
    const projectRepo = makeProjectRepo(makeProject({ userId: "other-user" }));
    const fpRepo = makeFpRepo();

    await expect(
      reportFalsePositive("proj-1", "user-1", "A05_INJECTION", "title", "evidence", "reason", projectRepo, fpRepo)
    ).rejects.toThrow(ReportFalsePositiveError);
  });

  it("throws ReportFalsePositiveError when a report already exists for the same finding", async () => {
    const projectRepo = makeProjectRepo();
    const fpRepo = makeFpRepo(makeReport());

    await expect(
      reportFalsePositive("proj-1", "user-1", "A05_INJECTION", "SQL Injection", "src/db.ts:42 — snip", "reason", projectRepo, fpRepo)
    ).rejects.toThrow(ReportFalsePositiveError);

    expect(fpRepo.create).not.toHaveBeenCalled();
  });
});
