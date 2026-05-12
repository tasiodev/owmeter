import { describe, it, expect, vi, beforeEach } from "vitest";
import { createScan, CreateScanError } from "../CreateScan";
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
    type: "BASIC",
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

describe("createScan", () => {
  const enqueue = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a scan and enqueues the job for a verified website", async () => {
    const websiteRepo = makeWebsiteRepo();
    const scanRepo = makeScanRepo();

    const scan = await createScan("site-1", "user-1", websiteRepo, scanRepo, enqueue);

    expect(scanRepo.create).toHaveBeenCalledWith("site-1");
    expect(enqueue).toHaveBeenCalledWith("scan-1", "https://example.com");
    expect(scan.id).toBe("scan-1");
  });

  it("throws CreateScanError when website not found", async () => {
    const websiteRepo = makeWebsiteRepo(null);
    const scanRepo = makeScanRepo();

    await expect(createScan("site-1", "user-1", websiteRepo, scanRepo, enqueue)).rejects.toThrow(
      CreateScanError
    );
    expect(scanRepo.create).not.toHaveBeenCalled();
  });

  it("throws CreateScanError when user does not own the website", async () => {
    const websiteRepo = makeWebsiteRepo(makeWebsite({ userId: "other-user" }));
    const scanRepo = makeScanRepo();

    await expect(createScan("site-1", "user-1", websiteRepo, scanRepo, enqueue)).rejects.toThrow(
      CreateScanError
    );
  });

  it("throws CreateScanError when website is not verified", async () => {
    const websiteRepo = makeWebsiteRepo(makeWebsite({ verified: false }));
    const scanRepo = makeScanRepo();

    await expect(createScan("site-1", "user-1", websiteRepo, scanRepo, enqueue)).rejects.toThrow(
      CreateScanError
    );
  });

  it("does not enqueue if scan creation fails", async () => {
    const websiteRepo = makeWebsiteRepo();
    const scanRepo = makeScanRepo();
    vi.mocked(scanRepo.create).mockRejectedValue(new Error("DB error"));

    await expect(createScan("site-1", "user-1", websiteRepo, scanRepo, enqueue)).rejects.toThrow(
      "DB error"
    );
    expect(enqueue).not.toHaveBeenCalled();
  });
});
