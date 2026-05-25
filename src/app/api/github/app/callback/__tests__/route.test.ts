import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import crypto from "node:crypto";

// ── Mocks (hoisted so vi.mock can reference them) ─────────────────────────────

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  connectGitHubInstallation: vi.fn(),
  getInstallationInfo: vi.fn(),
}));

vi.mock("@/infrastructure/auth/auth", () => ({ auth: mocks.auth }));

vi.mock("@/application/use-cases/ConnectGitHubInstallation", () => ({
  connectGitHubInstallation: mocks.connectGitHubInstallation,
}));

vi.mock("@/infrastructure/github/GitHubAppClient", () => ({
  getInstallationInfo: mocks.getInstallationInfo,
}));

vi.mock("@/infrastructure/database/repositories/PrismaGitHubInstallationRepository", () => ({
  PrismaGitHubInstallationRepository: function () { return {}; },
}));

vi.mock("@/infrastructure/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

import { GET } from "@/app/api/github/app/callback/route";

// ── Helpers ───────────────────────────────────────────────────────────────────

const AUTH_SECRET = "test-auth-secret-for-callback";
const APP_URL = "http://localhost:3000";
const SETTINGS_URL = `${APP_URL}/dashboard/settings`;
const ERROR_URL = `${SETTINGS_URL}?error=github_connect_failed`;

/**
 * Returns the VALUE of the gh_app_state cookie for a given state string.
 * Format: "<state>.<hmac>" — same as what install/route.ts generates.
 */
function signState(state: string, secret = AUTH_SECRET): string {
  const hmac = crypto.createHmac("sha256", secret).update(state).digest("hex");
  return `${state}.${hmac}`;
}

/**
 * Builds a NextRequest for the callback endpoint.
 *
 * @param cookieValue - The VALUE of the gh_app_state cookie (not the full header string).
 *   - `undefined` (default): auto-generates a valid signed value for the given state
 *   - `null`: omit the cookie entirely (simulates a missing cookie)
 *   - any string: use that exact value (allows tampered / wrong-secret cookies)
 *
 * Note: cookies are set directly via RequestCookies.set() to bypass header-parsing
 * inconsistencies in the happy-dom test environment.
 */
function makeRequest(params: {
  state?: string;
  installationId?: string;
  setupAction?: string;
  cookieValue?: string | null;
}): NextRequest {
  const { state = "valid-state", installationId = "42", setupAction = "install", cookieValue } = params;

  const url = new URL(`${APP_URL}/api/github/app/callback`);
  if (state) url.searchParams.set("state", state);
  if (installationId) url.searchParams.set("installation_id", installationId);
  if (setupAction) url.searchParams.set("setup_action", setupAction);

  const req = new NextRequest(url.toString());

  if (cookieValue !== null) {
    const val = cookieValue === undefined ? signState(state) : cookieValue;
    req.cookies.set("gh_app_state", val);
  }

  return req;
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  process.env.AUTH_SECRET = AUTH_SECRET;
  process.env.NEXT_PUBLIC_APP_URL = APP_URL;
  mocks.auth.mockResolvedValue({ user: { id: "user-1", email: "user@example.com" } });
  mocks.connectGitHubInstallation.mockResolvedValue({ installationId: 42 });
  mocks.getInstallationInfo.mockResolvedValue({ targetLogin: "octocat", targetType: "User" });
});

afterEach(() => {
  delete process.env.AUTH_SECRET;
  delete process.env.NEXT_PUBLIC_APP_URL;
});

// ── Auth guard ────────────────────────────────────────────────────────────────

describe("GET /api/github/app/callback — auth", () => {
  it("redirects to /login when the user is not authenticated", async () => {
    mocks.auth.mockResolvedValue(null);
    const res = await GET(makeRequest({}));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(`${APP_URL}/login`);
    expect(mocks.connectGitHubInstallation).not.toHaveBeenCalled();
  });
});

// ── CSRF verification ─────────────────────────────────────────────────────────

describe("GET /api/github/app/callback — CSRF", () => {
  it("redirects to error when the CSRF cookie is missing", async () => {
    const res = await GET(makeRequest({ cookieValue: null }));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(ERROR_URL);
    expect(mocks.connectGitHubInstallation).not.toHaveBeenCalled();
  });

  it("redirects to error when the query state does not match the cookie state", async () => {
    const res = await GET(makeRequest({
      state: "different-state",
      // cookie is signed for "original-state", query has "different-state"
      cookieValue: signState("original-state"),
    }));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(ERROR_URL);
    expect(mocks.connectGitHubInstallation).not.toHaveBeenCalled();
  });

  it("redirects to error when the HMAC in the cookie has been tampered with", async () => {
    const state = "valid-state";
    // SHA-256 output is 32 bytes = 64 hex chars; use all-zeros to keep same length
    const tamperedHmac = "0".repeat(64);
    const res = await GET(makeRequest({ state, cookieValue: `${state}.${tamperedHmac}` }));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(ERROR_URL);
    expect(mocks.connectGitHubInstallation).not.toHaveBeenCalled();
  });

  it("redirects to error when the HMAC was signed with a different secret", async () => {
    const state = "valid-state";
    const res = await GET(makeRequest({ state, cookieValue: signState(state, "wrong-secret") }));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(ERROR_URL);
    expect(mocks.connectGitHubInstallation).not.toHaveBeenCalled();
  });
});

// ── Parameter validation ──────────────────────────────────────────────────────

describe("GET /api/github/app/callback — parameter validation", () => {
  it("redirects to error when installation_id is missing", async () => {
    const res = await GET(makeRequest({ installationId: "" }));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(ERROR_URL);
  });

  it("redirects to error when setup_action is unrecognised", async () => {
    const res = await GET(makeRequest({ setupAction: "uninstall" }));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(ERROR_URL);
  });

  it("accepts 'update' as a valid setup_action", async () => {
    const res = await GET(makeRequest({ setupAction: "update" }));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(SETTINGS_URL);
  });

  it("redirects to error when installation_id is not a valid number", async () => {
    const res = await GET(makeRequest({ installationId: "not-a-number" }));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(ERROR_URL);
  });

  it("redirects to error when installation_id is zero", async () => {
    const res = await GET(makeRequest({ installationId: "0" }));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(ERROR_URL);
  });
});

// ── Happy path ────────────────────────────────────────────────────────────────

describe("GET /api/github/app/callback — happy path", () => {
  it("connects the installation and redirects to Settings", async () => {
    const res = await GET(makeRequest({ installationId: "42" }));

    expect(mocks.connectGitHubInstallation).toHaveBeenCalledWith(
      "user-1",
      42,
      mocks.getInstallationInfo,
      expect.anything()
    );
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(SETTINGS_URL);
  });

  it("deletes the CSRF cookie on success", async () => {
    const res = await GET(makeRequest({}));

    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("gh_app_state");
  });

  it("redirects to error and deletes CSRF cookie when connectGitHubInstallation throws", async () => {
    mocks.connectGitHubInstallation.mockRejectedValue(new Error("DB error"));

    const res = await GET(makeRequest({}));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(ERROR_URL);
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("gh_app_state");
  });
});
