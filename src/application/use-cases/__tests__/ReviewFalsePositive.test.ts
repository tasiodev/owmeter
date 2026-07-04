import { describe, it, expect, vi, beforeEach } from "vitest";
import { reviewFalsePositive, ReviewFalsePositiveError } from "../ReviewFalsePositive";
import type { IFalsePositiveReportRepository } from "@/domain/repositories/IFalsePositiveReportRepository";
import type { FalsePositiveReport } from "@/domain/entities/FalsePositiveReport";

const now = new Date();

function makeReport(overrides: Partial<FalsePositiveReport> = {}): FalsePositiveReport {
  return {
    id: "fp-1",
    projectId: "proj-1",
    reportedById: "user-1",
    category: "A05_INJECTION",
    title: "SQL Injection",
    filePath: "src/db.ts",
    evidence: "src/db.ts:42 — query snippet",
    reason: "Test helper, not production code.",
    status: "PENDING",
    reviewedById: null,
    reviewedAt: null,
    adminNote: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeFpRepo(report: FalsePositiveReport | null = makeReport()): IFalsePositiveReportRepository {
  return {
    findByProject: vi.fn(),
    findApprovedByProject: vi.fn(),
    findAll: vi.fn(),
    findAllWithDetails: vi.fn(),
    findById: vi.fn().mockResolvedValue(report),
    findExisting: vi.fn(),
    create: vi.fn(),
    updateStatus: vi.fn().mockImplementation((_id, status, reviewedById, adminNote) =>
      Promise.resolve(makeReport({ status, reviewedById, adminNote: adminNote ?? null }))
    ),
  };
}

describe("reviewFalsePositive", () => {
  beforeEach(() => vi.clearAllMocks());

  it("approves a PENDING report", async () => {
    const fpRepo = makeFpRepo();

    const result = await reviewFalsePositive("fp-1", "APPROVED", "admin-1", undefined, fpRepo);

    expect(fpRepo.updateStatus).toHaveBeenCalledWith("fp-1", "APPROVED", "admin-1", undefined);
    expect(result.status).toBe("APPROVED");
  });

  it("rejects a PENDING report", async () => {
    const fpRepo = makeFpRepo();

    const result = await reviewFalsePositive("fp-1", "REJECTED", "admin-1", undefined, fpRepo);

    expect(fpRepo.updateStatus).toHaveBeenCalledWith("fp-1", "REJECTED", "admin-1", undefined);
    expect(result.status).toBe("REJECTED");
  });

  it("passes adminNote through to the repository", async () => {
    const fpRepo = makeFpRepo();

    await reviewFalsePositive("fp-1", "REJECTED", "admin-1", "Not enough evidence.", fpRepo);

    expect(fpRepo.updateStatus).toHaveBeenCalledWith("fp-1", "REJECTED", "admin-1", "Not enough evidence.");
  });

  it("throws ReviewFalsePositiveError when report is not found", async () => {
    const fpRepo = makeFpRepo(null);

    await expect(
      reviewFalsePositive("fp-missing", "APPROVED", "admin-1", undefined, fpRepo)
    ).rejects.toThrow(ReviewFalsePositiveError);

    expect(fpRepo.updateStatus).not.toHaveBeenCalled();
  });

  it("throws ReviewFalsePositiveError when report already has the target status", async () => {
    const fpRepo = makeFpRepo(makeReport({ status: "APPROVED" }));

    await expect(
      reviewFalsePositive("fp-1", "APPROVED", "admin-1", undefined, fpRepo)
    ).rejects.toThrow(ReviewFalsePositiveError);
  });

  it("allows approving a previously REJECTED report", async () => {
    const fpRepo = makeFpRepo(makeReport({ status: "REJECTED" }));

    const result = await reviewFalsePositive("fp-1", "APPROVED", "admin-1", undefined, fpRepo);

    expect(fpRepo.updateStatus).toHaveBeenCalledOnce();
    expect(result.status).toBe("APPROVED");
  });

  it("allows rejecting a previously APPROVED report", async () => {
    const fpRepo = makeFpRepo(makeReport({ status: "APPROVED" }));

    const result = await reviewFalsePositive("fp-1", "REJECTED", "admin-1", undefined, fpRepo);

    expect(fpRepo.updateStatus).toHaveBeenCalledOnce();
    expect(result.status).toBe("REJECTED");
  });
});
