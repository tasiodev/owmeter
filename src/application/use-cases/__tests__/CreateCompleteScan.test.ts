import { describe, it, expect, vi, beforeEach } from "vitest";
import { createCompleteScan, CreateCompleteScanError } from "../CreateCompleteScan";
import type { IWebsiteRepository } from "@/domain/repositories/IWebsiteRepository";
import type { IScanRepository } from "@/domain/repositories/IScanRepository";
import type { Website } from "@/domain/entities/Website";
import type { Scan } from "@/domain/entities/Scan";

const now = new Date();

function makeWebsite(overrides: Partial<Website> = {}): Website {
  return {
    id: "site-1",
    domain: "example.com",
    userId: "user-1",
    verified: true,
    verificationToken: "token-abc",
    verificationMethod: "DNS_TXT",
    verifiedAt: now,
    createdAt: now,
    ...overrides,
  };
}

function makeScan(): Scan {
  return {
    id: "scan-1",
    websiteId: "site-1",
    status: "PENDING",
    type: "COMPLETE",
    score: null,
    maxScore: null,
    inRanking: false,
    findings: [],
    startedAt: now,
    completedAt: null,
  };
}

function makeWebsiteRepo(website: Website | null = makeWebsite()): IWebsiteRepository {
  return {
    findById: vi.fn().mockResolvedValue(website),
    findByDomainAndUserId: vi.fn(),
    findVerifiedByDomain: vi.fn(),
    findByUserId: vi.fn(),
    create: vi.fn(),
    markVerified: vi.fn(),
    deleteUnverifiedByDomain: vi.fn(),
    delete: vi.fn(),
  };
}

function makeScanRepo(scan: Scan = makeScan()): IScanRepository {
  return {
    findById: vi.fn(),
    findByWebsiteId: vi.fn(),
    findRanking: vi.fn(),
    create: vi.fn().mockResolvedValue(scan),
    updateStatus: vi.fn(),
    complete: vi.fn(),
    updateRanking: vi.fn(),
  };
}

const smallZip = new Uint8Array(100);
const FIFTY_MB_PLUS_ONE = new Uint8Array(50 * 1024 * 1024 + 1);

describe("createCompleteScan — ZIP input", () => {
  const enqueue = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => vi.clearAllMocks());

  it("creates a COMPLETE scan and enqueues ZIP job", async () => {
    const websiteRepo = makeWebsiteRepo();
    const scanRepo = makeScanRepo();

    const scan = await createCompleteScan(
      "site-1",
      "user-1",
      { kind: "zip", zipBuffer: smallZip },
      websiteRepo,
      scanRepo,
      enqueue
    );

    expect(scanRepo.create).toHaveBeenCalledWith("site-1", "COMPLETE");
    expect(enqueue).toHaveBeenCalledOnce();
    const jobData = enqueue.mock.calls[0][0] as { type: string; sourceZip: string };
    expect(jobData.type).toBe("COMPLETE");
    expect(jobData.sourceZip).toBeTruthy();
    expect(scan.id).toBe("scan-1");
  });

  it("throws when website not found", async () => {
    await expect(
      createCompleteScan("site-1", "user-1", { kind: "zip", zipBuffer: smallZip }, makeWebsiteRepo(null), makeScanRepo(), enqueue)
    ).rejects.toThrow(CreateCompleteScanError);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("throws when user does not own the website", async () => {
    await expect(
      createCompleteScan("site-1", "user-1", { kind: "zip", zipBuffer: smallZip }, makeWebsiteRepo(makeWebsite({ userId: "other" })), makeScanRepo(), enqueue)
    ).rejects.toThrow(CreateCompleteScanError);
  });

  it("throws when website is not verified", async () => {
    await expect(
      createCompleteScan("site-1", "user-1", { kind: "zip", zipBuffer: smallZip }, makeWebsiteRepo(makeWebsite({ verified: false })), makeScanRepo(), enqueue)
    ).rejects.toThrow(CreateCompleteScanError);
  });

  it("throws when ZIP exceeds 50 MB", async () => {
    await expect(
      createCompleteScan("site-1", "user-1", { kind: "zip", zipBuffer: FIFTY_MB_PLUS_ONE }, makeWebsiteRepo(), makeScanRepo(), enqueue)
    ).rejects.toThrow(CreateCompleteScanError);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("does not enqueue if scan creation fails", async () => {
    const scanRepo = makeScanRepo();
    vi.mocked(scanRepo.create).mockRejectedValue(new Error("DB error"));

    await expect(
      createCompleteScan("site-1", "user-1", { kind: "zip", zipBuffer: smallZip }, makeWebsiteRepo(), scanRepo, enqueue)
    ).rejects.toThrow("DB error");
    expect(enqueue).not.toHaveBeenCalled();
  });
});

describe("createCompleteScan — GitHub URL input", () => {
  const enqueue = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => vi.clearAllMocks());

  it("creates a COMPLETE scan and enqueues GitHub job", async () => {
    const websiteRepo = makeWebsiteRepo();
    const scanRepo = makeScanRepo();

    const scan = await createCompleteScan(
      "site-1",
      "user-1",
      { kind: "github", githubUrl: "https://github.com/owner/repo" },
      websiteRepo,
      scanRepo,
      enqueue
    );

    expect(scanRepo.create).toHaveBeenCalledWith("site-1", "COMPLETE");
    const jobData = enqueue.mock.calls[0][0] as { type: string; githubUrl: string };
    expect(jobData.type).toBe("COMPLETE");
    expect(jobData.githubUrl).toBe("https://github.com/owner/repo");
    expect(scan.id).toBe("scan-1");
  });

  it("throws when GitHub URL is invalid", async () => {
    await expect(
      createCompleteScan("site-1", "user-1", { kind: "github", githubUrl: "https://gitlab.com/owner/repo" }, makeWebsiteRepo(), makeScanRepo(), enqueue)
    ).rejects.toThrow(CreateCompleteScanError);
  });

  it("throws when GitHub URL is not a URL", async () => {
    await expect(
      createCompleteScan("site-1", "user-1", { kind: "github", githubUrl: "not-a-url" }, makeWebsiteRepo(), makeScanRepo(), enqueue)
    ).rejects.toThrow(CreateCompleteScanError);
  });
});
