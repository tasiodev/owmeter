import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import crypto from "node:crypto";

// ── Mocks (hoisted so vi.mock can reference them) ─────────────────────────────

const mocks = vi.hoisted(() => ({
  clearPrivateReposByInstallation: vi.fn(),
  deleteByInstallationId: vi.fn(),
}));

vi.mock("@/infrastructure/database/repositories/PrismaGitHubInstallationRepository", () => ({
  PrismaGitHubInstallationRepository: function () {
    return { deleteByInstallationId: mocks.deleteByInstallationId };
  },
}));

vi.mock("@/infrastructure/database/repositories/PrismaProjectRepository", () => ({
  PrismaProjectRepository: function () {
    return { clearPrivateReposByInstallation: mocks.clearPrivateReposByInstallation };
  },
}));

vi.mock("@/infrastructure/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

import { POST } from "@/app/api/github/webhooks/route";

// ── Helpers ───────────────────────────────────────────────────────────────────

const WEBHOOK_SECRET = "test-webhook-secret-xyz";

function sign(body: string, secret = WEBHOOK_SECRET): string {
  return "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("hex");
}

function makeRequest(body: string, options: { sig?: string | null; event?: string } = {}): NextRequest {
  const sig = options.sig === undefined ? sign(body) : options.sig;
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (sig !== null) headers["x-hub-signature-256"] = sig;
  if (options.event) headers["x-github-event"] = options.event;
  return new NextRequest("http://localhost/api/github/webhooks", {
    method: "POST",
    body,
    headers,
  });
}

const deletedPayload = JSON.stringify({
  action: "deleted",
  installation: { id: 42 },
});

// ── Lifecycle ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  process.env.GITHUB_WEBHOOK_SECRET = WEBHOOK_SECRET;
  mocks.clearPrivateReposByInstallation.mockResolvedValue(undefined);
  mocks.deleteByInstallationId.mockResolvedValue(undefined);
  vi.clearAllMocks();
});

afterEach(() => {
  delete process.env.GITHUB_WEBHOOK_SECRET;
});

// ── Signature verification ────────────────────────────────────────────────────

describe("POST /api/github/webhooks — signature verification", () => {
  it("returns 403 when GITHUB_WEBHOOK_SECRET is not configured", async () => {
    delete process.env.GITHUB_WEBHOOK_SECRET;
    const res = await POST(makeRequest(deletedPayload));
    expect(res.status).toBe(403);
  });

  it("returns 403 when the signature header is missing", async () => {
    const res = await POST(makeRequest(deletedPayload, { sig: null }));
    expect(res.status).toBe(403);
  });

  it("returns 403 when the signature is wrong", async () => {
    const res = await POST(makeRequest(deletedPayload, { sig: "sha256=deadbeef" }));
    expect(res.status).toBe(403);
  });

  it("returns 403 when the signature was computed with a different secret", async () => {
    const wrongSig = sign(deletedPayload, "different-secret");
    const res = await POST(makeRequest(deletedPayload, { sig: wrongSig }));
    expect(res.status).toBe(403);
  });

  it("returns 403 when the body was tampered with after signing", async () => {
    const originalSig = sign(deletedPayload);
    const tamperedBody = deletedPayload.replace("42", "99");
    const res = await POST(makeRequest(tamperedBody, { sig: originalSig }));
    expect(res.status).toBe(403);
  });
});

// ── installation.deleted ──────────────────────────────────────────────────────

describe("POST /api/github/webhooks — installation.deleted", () => {
  it("clears project repos and deletes installation, returns 204", async () => {
    const res = await POST(makeRequest(deletedPayload, { event: "installation" }));

    expect(res.status).toBe(204);
    expect(mocks.clearPrivateReposByInstallation).toHaveBeenCalledWith(42);
    expect(mocks.deleteByInstallationId).toHaveBeenCalledWith(42);
  });

  it("clears project repos before deleting the installation record", async () => {
    const callOrder: string[] = [];
    mocks.clearPrivateReposByInstallation.mockImplementation(() => {
      callOrder.push("clear");
      return Promise.resolve();
    });
    mocks.deleteByInstallationId.mockImplementation(() => {
      callOrder.push("delete");
      return Promise.resolve();
    });

    await POST(makeRequest(deletedPayload, { event: "installation" }));

    expect(callOrder).toEqual(["clear", "delete"]);
  });
});

// ── installation.suspend ──────────────────────────────────────────────────────

describe("POST /api/github/webhooks — installation.suspend", () => {
  it("performs the same cleanup as installation.deleted", async () => {
    const suspendPayload = JSON.stringify({
      action: "suspend",
      installation: { id: 55 },
    });

    const res = await POST(makeRequest(suspendPayload, { event: "installation" }));

    expect(res.status).toBe(204);
    expect(mocks.clearPrivateReposByInstallation).toHaveBeenCalledWith(55);
    expect(mocks.deleteByInstallationId).toHaveBeenCalledWith(55);
  });
});

// ── Unhandled events / bad payloads ──────────────────────────────────────────

describe("POST /api/github/webhooks — other events", () => {
  it("returns 204 without touching the DB for unrelated events", async () => {
    const pushPayload = JSON.stringify({ ref: "refs/heads/main" });
    const res = await POST(makeRequest(pushPayload, { event: "push" }));

    expect(res.status).toBe(204);
    expect(mocks.clearPrivateReposByInstallation).not.toHaveBeenCalled();
    expect(mocks.deleteByInstallationId).not.toHaveBeenCalled();
  });

  it("returns 204 for installation events with unrecognised actions (e.g. 'created')", async () => {
    const createdPayload = JSON.stringify({ action: "created", installation: { id: 42 } });
    const res = await POST(makeRequest(createdPayload, { event: "installation" }));

    expect(res.status).toBe(204);
    expect(mocks.clearPrivateReposByInstallation).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid JSON body", async () => {
    const badBody = "not json {{{";
    const res = await POST(makeRequest(badBody));

    expect(res.status).toBe(400);
  });
});
