import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  findAllWithProjects: vi.fn(),
  banUser: vi.fn(),
  unbanUser: vi.fn(),
  findUnique: vi.fn(),
  auth: vi.fn(),
  isAdmin: vi.fn(),
}));

vi.mock("@/infrastructure/auth/auth", () => ({ auth: mocks.auth }));
vi.mock("@/infrastructure/auth/isAdmin", () => ({ isAdmin: mocks.isAdmin }));
vi.mock("@/infrastructure/database/repositories/PrismaUserRepository", () => ({
  PrismaUserRepository: function () {
    return {
      findAllWithProjects: mocks.findAllWithProjects,
      banUser: mocks.banUser,
      unbanUser: mocks.unbanUser,
      isBanned: vi.fn(),
    };
  },
}));
vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: { user: { findUnique: mocks.findUnique } },
}));

import { GET } from "@/app/api/admin/users/route";
import { POST as banRoute } from "@/app/api/admin/users/[userId]/ban/route";
import { POST as unbanRoute } from "@/app/api/admin/users/[userId]/unban/route";

const adminSession = { user: { id: "admin-1", email: "admin@example.com" } };

function makeParams(userId: string) {
  return { params: Promise.resolve({ userId }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue(adminSession);
  mocks.isAdmin.mockImplementation((email: string) => email === "admin@example.com");
});

// ─── GET /api/admin/users ──────────────────────────────────────────────────

describe("GET /api/admin/users", () => {
  it("returns 403 when not authenticated", async () => {
    mocks.auth.mockResolvedValue(null);
    const res = await GET(new NextRequest("http://localhost/api/admin/users"));
    expect(res.status).toBe(403);
  });

  it("returns 403 when not admin", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "u1", email: "user@example.com" } });
    const res = await GET(new NextRequest("http://localhost/api/admin/users"));
    expect(res.status).toBe(403);
  });

  it("returns users list when admin", async () => {
    const users = [{ id: "u1", email: "a@b.com", projects: [] }];
    mocks.findAllWithProjects.mockResolvedValue(users);

    const res = await GET(new NextRequest("http://localhost/api/admin/users"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(users);
    expect(mocks.findAllWithProjects).toHaveBeenCalledWith(undefined);
  });

  it("passes search param to repository", async () => {
    mocks.findAllWithProjects.mockResolvedValue([]);
    const res = await GET(new NextRequest("http://localhost/api/admin/users?search=alice"));
    expect(res.status).toBe(200);
    expect(mocks.findAllWithProjects).toHaveBeenCalledWith("alice");
  });

  it("treats empty search as undefined", async () => {
    mocks.findAllWithProjects.mockResolvedValue([]);
    await GET(new NextRequest("http://localhost/api/admin/users?search="));
    expect(mocks.findAllWithProjects).toHaveBeenCalledWith(undefined);
  });
});

// ─── POST /api/admin/users/[userId]/ban ───────────────────────────────────

describe("POST /api/admin/users/[userId]/ban", () => {
  it("returns 403 when not admin", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "u1", email: "user@example.com" } });
    const res = await banRoute(new NextRequest("http://localhost/"), makeParams("target-1"));
    expect(res.status).toBe(403);
  });

  it("returns 404 when user does not exist", async () => {
    mocks.findUnique.mockResolvedValue(null);
    const res = await banRoute(new NextRequest("http://localhost/"), makeParams("ghost"));
    expect(res.status).toBe(404);
  });

  it("returns 400 when trying to ban an admin", async () => {
    mocks.findUnique.mockResolvedValue({ email: "admin@example.com" });
    const res = await banRoute(new NextRequest("http://localhost/"), makeParams("admin-2"));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "Cannot ban an admin" });
  });

  it("bans user and returns ok", async () => {
    mocks.findUnique.mockResolvedValue({ email: "victim@example.com" });
    mocks.banUser.mockResolvedValue(undefined);
    const res = await banRoute(new NextRequest("http://localhost/"), makeParams("victim-id"));
    expect(res.status).toBe(200);
    expect(mocks.banUser).toHaveBeenCalledWith("victim-id");
  });
});

// ─── POST /api/admin/users/[userId]/unban ────────────────────────────────

describe("POST /api/admin/users/[userId]/unban", () => {
  it("returns 403 when not admin", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "u1", email: "user@example.com" } });
    const res = await unbanRoute(new NextRequest("http://localhost/"), makeParams("u1"));
    expect(res.status).toBe(403);
  });

  it("unbans user and returns ok", async () => {
    mocks.unbanUser.mockResolvedValue(undefined);
    const res = await unbanRoute(new NextRequest("http://localhost/"), makeParams("u1"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(mocks.unbanUser).toHaveBeenCalledWith("u1");
  });
});
