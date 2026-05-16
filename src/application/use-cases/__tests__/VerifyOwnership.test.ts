import { describe, it, expect, vi, beforeEach } from "vitest";
import { verifyDomainOwnership, VerificationError } from "../VerifyOwnership";
import type { IProjectRepository } from "@/domain/repositories/IProjectRepository";
import type { Project } from "@/domain/entities/Project";

const now = new Date();

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "proj-1",
    type: "WEBSITE",
    name: "My Site",
    domain: "example.com",
    userId: "user-1",
    verified: false,
    verificationToken: "TOKEN-XYZ",
    verificationMethod: null,
    verifiedAt: null,
    repoUrl: null,
    repoVerified: false,
    repoVerificationToken: "REPO-TOKEN",
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
    markDomainVerified: vi.fn().mockImplementation((_id, method) =>
      Promise.resolve({ ...makeProject(), verified: true, verificationMethod: method })
    ),
    markRepoVerified: vi.fn(),
    deleteUnverifiedByDomain: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn(),
  };
}

describe("verifyDomainOwnership", () => {
  beforeEach(() => vi.clearAllMocks());

  it("throws VerificationError when project not found", async () => {
    const repo = makeRepo(null);
    await expect(verifyDomainOwnership("proj-1", "user-1", "META_TAG", repo)).rejects.toThrow(
      VerificationError
    );
  });

  it("throws VerificationError when user does not own the project", async () => {
    const repo = makeRepo(makeProject({ userId: "other" }));
    await expect(verifyDomainOwnership("proj-1", "user-1", "META_TAG", repo)).rejects.toThrow(
      VerificationError
    );
  });

  it("throws VerificationError for CODE_REPO projects", async () => {
    const repo = makeRepo(makeProject({ type: "CODE_REPO", domain: null }));
    await expect(verifyDomainOwnership("proj-1", "user-1", "META_TAG", repo)).rejects.toThrow(
      VerificationError
    );
  });

  it("returns the project immediately if already verified", async () => {
    const verified = makeProject({ verified: true, verificationMethod: "DNS_TXT" });
    const repo = makeRepo(verified);
    const result = await verifyDomainOwnership("proj-1", "user-1", "DNS_TXT", repo);
    expect(result.verified).toBe(true);
    expect(repo.markDomainVerified).not.toHaveBeenCalled();
  });

  describe("META_TAG verification", () => {
    it("marks verified when meta tag is present in HTML", async () => {
      const repo = makeRepo();
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          text: async () =>
            `<html><head><meta name="owmeter-verify" content="TOKEN-XYZ"></head></html>`,
        })
      );

      const result = await verifyDomainOwnership("proj-1", "user-1", "META_TAG", repo);
      expect(result.verified).toBe(true);
      expect(repo.markDomainVerified).toHaveBeenCalledWith("proj-1", "META_TAG");

      vi.unstubAllGlobals();
    });

    it("throws VerificationError when meta tag is missing", async () => {
      const repo = makeRepo();
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ ok: true, text: async () => `<html><head></head></html>` })
      );

      await expect(verifyDomainOwnership("proj-1", "user-1", "META_TAG", repo)).rejects.toThrow(
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
        vi.fn().mockResolvedValue({ ok: true, text: async () => "TOKEN-XYZ" })
      );

      const result = await verifyDomainOwnership("proj-1", "user-1", "FILE", repo);
      expect(result.verified).toBe(true);
      vi.unstubAllGlobals();
    });

    it("throws VerificationError when file returns 404", async () => {
      const repo = makeRepo();
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

      await expect(verifyDomainOwnership("proj-1", "user-1", "FILE", repo)).rejects.toThrow(
        VerificationError
      );
      vi.unstubAllGlobals();
    });
  });

  it("deletes other users' unverified entries after domain verification", async () => {
    const repo = makeRepo();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () =>
          `<html><head><meta name="owmeter-verify" content="TOKEN-XYZ"></head></html>`,
      })
    );

    await verifyDomainOwnership("proj-1", "user-1", "META_TAG", repo);
    expect(repo.deleteUnverifiedByDomain).toHaveBeenCalledWith("example.com", "user-1");
    vi.unstubAllGlobals();
  });
});
