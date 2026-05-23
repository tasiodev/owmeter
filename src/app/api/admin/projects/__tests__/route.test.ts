import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  findById: vi.fn(),
  deleteProject: vi.fn(),
  createScan: vi.fn(),
  createCompleteScan: vi.fn(),
  auth: vi.fn(),
  isAdmin: vi.fn(),
}));

vi.mock("@/infrastructure/auth/auth", () => ({ auth: mocks.auth }));
vi.mock("@/infrastructure/auth/isAdmin", () => ({ isAdmin: mocks.isAdmin }));
vi.mock("@/infrastructure/database/repositories/PrismaProjectRepository", () => ({
  PrismaProjectRepository: function () {
    return { findById: mocks.findById, delete: mocks.deleteProject };
  },
}));
vi.mock("@/infrastructure/database/repositories/PrismaScanRepository", () => ({
  PrismaScanRepository: function () {
    return {};
  },
}));
vi.mock("@/application/use-cases/CreateScan", () => ({
  createScan: mocks.createScan,
  CreateScanError: class CreateScanError extends Error {},
}));
vi.mock("@/application/use-cases/CreateCompleteScan", () => ({
  createCompleteScan: mocks.createCompleteScan,
  CreateCompleteScanError: class CreateCompleteScanError extends Error {},
}));
vi.mock("@/application/use-cases/CreateCodeScan", () => ({
  createCodeScan: vi.fn(),
  CreateCodeScanError: class CreateCodeScanError extends Error {},
}));
vi.mock("@/infrastructure/queue/scanQueue", () => ({
  getScanQueue: () => ({ add: vi.fn() }),
}));

import { DELETE } from "@/app/api/admin/projects/[projectId]/route";
import { POST as scanRoute } from "@/app/api/admin/projects/[projectId]/scan/route";
import { CreateScanError } from "@/application/use-cases/CreateScan";

const adminSession = { user: { id: "admin-1", email: "admin@example.com" } };

function makeParams(projectId: string) {
  return { params: Promise.resolve({ projectId }) };
}

function makeProject(overrides = {}) {
  return {
    id: "proj-1",
    type: "WEBSITE",
    name: "My Site",
    domain: "example.com",
    userId: "user-1",
    verified: true,
    verificationToken: "tok",
    verificationMethod: "DNS_TXT",
    verifiedAt: new Date(),
    repoUrl: null,
    repoVerified: false,
    repoVerificationToken: null,
    repoVerifiedAt: null,
    isPublic: true,
    apiKey: "key",
    createdAt: new Date(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue(adminSession);
  mocks.isAdmin.mockImplementation((email: string) => email === "admin@example.com");
});

// ─── DELETE /api/admin/projects/[projectId] ───────────────────────────────

describe("DELETE /api/admin/projects/[projectId]", () => {
  it("returns 403 when not admin", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "u1", email: "user@example.com" } });
    const res = await DELETE(new NextRequest("http://localhost/"), makeParams("proj-1"));
    expect(res.status).toBe(403);
  });

  it("returns 404 when project not found", async () => {
    mocks.findById.mockResolvedValue(null);
    const res = await DELETE(new NextRequest("http://localhost/"), makeParams("ghost"));
    expect(res.status).toBe(404);
  });

  it("deletes project and returns ok", async () => {
    mocks.findById.mockResolvedValue(makeProject());
    mocks.deleteProject.mockResolvedValue(undefined);
    const res = await DELETE(new NextRequest("http://localhost/"), makeParams("proj-1"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(mocks.deleteProject).toHaveBeenCalledWith("proj-1");
  });
});

// ─── POST /api/admin/projects/[projectId]/scan ────────────────────────────

describe("POST /api/admin/projects/[projectId]/scan", () => {
  it("returns 403 when not admin", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "u1", email: "user@example.com" } });
    const res = await scanRoute(new NextRequest("http://localhost/"), makeParams("proj-1"));
    expect(res.status).toBe(403);
  });

  it("returns 404 when project not found", async () => {
    mocks.findById.mockResolvedValue(null);
    const res = await scanRoute(new NextRequest("http://localhost/"), makeParams("ghost"));
    expect(res.status).toBe(404);
  });

  it("queues PASSIVE scan for unverified website and returns 202", async () => {
    mocks.findById.mockResolvedValue(makeProject({ repoVerified: false }));
    mocks.createScan.mockResolvedValue({ id: "scan-1" });

    const res = await scanRoute(new NextRequest("http://localhost/"), makeParams("proj-1"));
    expect(res.status).toBe(202);
    expect(await res.json()).toMatchObject({ scanId: "scan-1", status: "queued" });
    expect(mocks.createScan).toHaveBeenCalled();
  });

  it("queues FULL scan for website with verified repo", async () => {
    mocks.findById.mockResolvedValue(makeProject({ repoVerified: true }));
    mocks.createCompleteScan.mockResolvedValue({ id: "scan-2" });

    const res = await scanRoute(new NextRequest("http://localhost/"), makeParams("proj-1"));
    expect(res.status).toBe(202);
    expect(await res.json()).toMatchObject({ scanId: "scan-2", status: "queued" });
    expect(mocks.createCompleteScan).toHaveBeenCalled();
  });

  it("returns 400 when scan use case throws CreateScanError", async () => {
    mocks.findById.mockResolvedValue(makeProject());
    mocks.createScan.mockRejectedValue(new CreateScanError("no verified domain"));

    const res = await scanRoute(new NextRequest("http://localhost/"), makeParams("proj-1"));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "SCAN_ERROR" });
  });
});
