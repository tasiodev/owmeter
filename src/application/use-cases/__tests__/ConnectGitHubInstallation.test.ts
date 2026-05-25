import { describe, it, expect, vi, beforeEach } from "vitest";
import { connectGitHubInstallation, ConnectGitHubInstallationError } from "../ConnectGitHubInstallation";
import type { IGitHubInstallationRepository } from "@/domain/repositories/IGitHubInstallationRepository";
import type { GitHubInstallation } from "@/domain/entities/GitHubInstallation";

const now = new Date();

function makeInstallation(overrides: Partial<GitHubInstallation> = {}): GitHubInstallation {
  return {
    id: "inst-1",
    userId: "user-1",
    installationId: 42,
    targetType: "User",
    targetLogin: "octocat",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeRepo(installation: GitHubInstallation = makeInstallation()): IGitHubInstallationRepository {
  return {
    findByUserId: vi.fn(),
    findByInstallationId: vi.fn(),
    upsert: vi.fn().mockResolvedValue(installation),
    deleteByUserId: vi.fn(),
    deleteByInstallationId: vi.fn(),
  };
}

const getInstallationInfo = vi.fn().mockResolvedValue({
  targetLogin: "octocat",
  targetType: "User",
});

describe("connectGitHubInstallation", () => {
  beforeEach(() => vi.clearAllMocks());

  // ── Input validation ──────────────────────────────────────────────────────

  it("throws ConnectGitHubInstallationError when userId is empty", async () => {
    await expect(
      connectGitHubInstallation("", 42, getInstallationInfo, makeRepo())
    ).rejects.toThrow(ConnectGitHubInstallationError);
    expect(getInstallationInfo).not.toHaveBeenCalled();
  });

  it("throws ConnectGitHubInstallationError when installationId is 0", async () => {
    await expect(
      connectGitHubInstallation("user-1", 0, getInstallationInfo, makeRepo())
    ).rejects.toThrow(ConnectGitHubInstallationError);
  });

  it("throws ConnectGitHubInstallationError when installationId is negative", async () => {
    await expect(
      connectGitHubInstallation("user-1", -1, getInstallationInfo, makeRepo())
    ).rejects.toThrow(ConnectGitHubInstallationError);
  });

  // ── Happy path ────────────────────────────────────────────────────────────

  it("fetches installation info and upserts the record", async () => {
    const repo = makeRepo();
    const result = await connectGitHubInstallation("user-1", 42, getInstallationInfo, repo);

    expect(getInstallationInfo).toHaveBeenCalledWith(42);
    expect(repo.upsert).toHaveBeenCalledWith({
      userId: "user-1",
      installationId: 42,
      targetType: "User",
      targetLogin: "octocat",
    });
    expect(result.installationId).toBe(42);
    expect(result.userId).toBe("user-1");
  });

  it("works for Organization installations", async () => {
    getInstallationInfo.mockResolvedValue({ targetLogin: "my-org", targetType: "Organization" });
    const repo = makeRepo(makeInstallation({ targetType: "Organization", targetLogin: "my-org" }));

    const result = await connectGitHubInstallation("user-1", 42, getInstallationInfo, repo);

    expect(repo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ targetType: "Organization", targetLogin: "my-org" })
    );
    expect(result.targetType).toBe("Organization");
  });

  it("propagates errors thrown by getInstallationInfo", async () => {
    getInstallationInfo.mockRejectedValue(new Error("GitHub API error"));
    await expect(
      connectGitHubInstallation("user-1", 42, getInstallationInfo, makeRepo())
    ).rejects.toThrow("GitHub API error");
  });
});
