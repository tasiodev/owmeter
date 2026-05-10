import { describe, it, expect, vi, beforeEach } from "vitest";
import { verifyOwnership, VerificationError } from "../VerifyOwnership";
import type { IWebsiteRepository } from "@/domain/repositories/IWebsiteRepository";
import type { Website } from "@/domain/entities/Website";

const now = new Date();

function makeWebsite(overrides: Partial<Website> = {}): Website {
  return {
    id: "site-1",
    domain: "example.com",
    userId: "user-1",
    verified: false,
    verificationToken: "TOKEN-XYZ",
    verificationMethod: null,
    verifiedAt: null,
    createdAt: now,
    ...overrides,
  };
}

function makeRepo(website: Website | null = makeWebsite()): IWebsiteRepository {
  return {
    findById: vi.fn().mockResolvedValue(website),
    findByDomain: vi.fn(),
    findByUserId: vi.fn(),
    create: vi.fn(),
    markVerified: vi.fn().mockImplementation((_id, method) =>
      Promise.resolve({ ...makeWebsite(), verified: true, verificationMethod: method })
    ),
    delete: vi.fn(),
  };
}

describe("verifyOwnership", () => {
  beforeEach(() => vi.clearAllMocks());

  it("throws VerificationError when website not found", async () => {
    const repo = makeRepo(null);
    await expect(verifyOwnership("site-1", "user-1", "META_TAG", repo)).rejects.toThrow(
      VerificationError
    );
  });

  it("throws VerificationError when user does not own the website", async () => {
    const repo = makeRepo(makeWebsite({ userId: "other" }));
    await expect(verifyOwnership("site-1", "user-1", "META_TAG", repo)).rejects.toThrow(
      VerificationError
    );
  });

  it("returns the website immediately if already verified", async () => {
    const verified = makeWebsite({ verified: true, verificationMethod: "DNS_TXT" });
    const repo = makeRepo(verified);
    const result = await verifyOwnership("site-1", "user-1", "DNS_TXT", repo);
    expect(result.verified).toBe(true);
    expect(repo.markVerified).not.toHaveBeenCalled();
  });

  describe("META_TAG verification", () => {
    it("marks verified when meta tag is present in HTML", async () => {
      const repo = makeRepo();
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          text: async () =>
            `<html><head><meta name="owaspchecker-verify" content="TOKEN-XYZ"></head></html>`,
        })
      );

      const result = await verifyOwnership("site-1", "user-1", "META_TAG", repo);
      expect(result.verified).toBe(true);
      expect(repo.markVerified).toHaveBeenCalledWith("site-1", "META_TAG");

      vi.unstubAllGlobals();
    });

    it("throws VerificationError when meta tag is missing", async () => {
      const repo = makeRepo();
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          text: async () => `<html><head></head></html>`,
        })
      );

      await expect(verifyOwnership("site-1", "user-1", "META_TAG", repo)).rejects.toThrow(
        VerificationError
      );
      vi.unstubAllGlobals();
    });
  });

  describe("FILE verification", () => {
    it("marks verified when file contains the token", async () => {
      const repo = makeRepo();
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          text: async () => "TOKEN-XYZ",
        })
      );

      const result = await verifyOwnership("site-1", "user-1", "FILE", repo);
      expect(result.verified).toBe(true);
      vi.unstubAllGlobals();
    });

    it("throws VerificationError when file returns 404", async () => {
      const repo = makeRepo();
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ ok: false })
      );

      await expect(verifyOwnership("site-1", "user-1", "FILE", repo)).rejects.toThrow(
        VerificationError
      );
      vi.unstubAllGlobals();
    });
  });
});
