import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import crypto from "node:crypto";
import {
  getInstallationToken,
  listInstallationRepos,
  verifyRepoAccess,
  getInstallationInfo,
} from "../GitHubAppClient";

// ── Test RSA key (generated once for all tests) ───────────────────────────────
const { privateKey: TEST_PRIVATE_KEY_PEM } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});
const TEST_PRIVATE_KEY_B64 = Buffer.from(TEST_PRIVATE_KEY_PEM).toString("base64");
const TEST_APP_ID = "123456";

// ── Fetch mock helpers ────────────────────────────────────────────────────────

type MockResponse = { ok?: boolean; status?: number; body?: unknown };

function stubFetch(...responses: MockResponse[]) {
  let call = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(() => {
      const r = responses[Math.min(call++, responses.length - 1)];
      return Promise.resolve({
        ok: r.ok ?? (r.status !== undefined ? r.status < 400 : true),
        status: r.status ?? 200,
        json: async () => r.body ?? {},
        text: async () => JSON.stringify(r.body ?? {}),
      });
    })
  );
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  process.env.GITHUB_APP_ID = TEST_APP_ID;
  process.env.GITHUB_APP_PRIVATE_KEY = TEST_PRIVATE_KEY_B64;
  vi.clearAllMocks();
});

afterEach(() => {
  delete process.env.GITHUB_APP_ID;
  delete process.env.GITHUB_APP_PRIVATE_KEY;
  vi.unstubAllGlobals();
});

// ── getInstallationToken ──────────────────────────────────────────────────────

describe("getInstallationToken", () => {
  it("POSTs to the correct GitHub API endpoint", async () => {
    stubFetch({ body: { token: "ghs_test_token" } });

    await getInstallationToken(42);

    const [url, opts] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.github.com/app/installations/42/access_tokens");
    expect(opts.method).toBe("POST");
  });

  it("sends a Bearer JWT in the Authorization header", async () => {
    stubFetch({ body: { token: "ghs_test_token" } });

    await getInstallationToken(42);

    const [, opts] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const auth = (opts.headers as Record<string, string>).Authorization;
    expect(auth).toMatch(/^Bearer /);
    // JWT must have three base64url parts
    const parts = auth.replace("Bearer ", "").split(".");
    expect(parts).toHaveLength(3);
  });

  it("embeds the App ID as the JWT issuer (iss claim)", async () => {
    stubFetch({ body: { token: "ghs_test_token" } });

    await getInstallationToken(42);

    const [, opts] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const jwt = (opts.headers as Record<string, string>).Authorization.replace("Bearer ", "");
    const payloadJson = Buffer.from(jwt.split(".")[1], "base64url").toString("utf-8");
    const payload = JSON.parse(payloadJson) as { iss: string; iat: number; exp: number };
    expect(payload.iss).toBe(TEST_APP_ID);
    expect(payload.exp).toBeGreaterThan(payload.iat);
  });

  it("returns the token from the GitHub API response", async () => {
    stubFetch({ body: { token: "ghs_abc123" } });

    const token = await getInstallationToken(42);

    expect(token).toBe("ghs_abc123");
  });

  it("throws when GitHub returns a non-ok response", async () => {
    stubFetch({ ok: false, status: 401, body: { message: "Unauthorized" } });

    await expect(getInstallationToken(42)).rejects.toThrow();
  });

  it("throws when GITHUB_APP_ID env var is missing", async () => {
    delete process.env.GITHUB_APP_ID;

    await expect(getInstallationToken(42)).rejects.toThrow(
      "GITHUB_APP_PRIVATE_KEY and GITHUB_APP_ID env vars are required"
    );
  });

  it("throws when GITHUB_APP_PRIVATE_KEY env var is missing", async () => {
    delete process.env.GITHUB_APP_PRIVATE_KEY;

    await expect(getInstallationToken(42)).rejects.toThrow(
      "GITHUB_APP_PRIVATE_KEY and GITHUB_APP_ID env vars are required"
    );
  });
});

// ── listInstallationRepos ─────────────────────────────────────────────────────

describe("listInstallationRepos", () => {
  it("returns an empty array when no repos are accessible", async () => {
    stubFetch(
      { body: { token: "ghs_tok" } },                                  // token exchange
      { body: { repositories: [], total_count: 0 } }                   // repos page 1
    );

    const repos = await listInstallationRepos(42);

    expect(repos).toEqual([]);
  });

  it("maps GitHub API fields to domain GitHubRepo shape", async () => {
    stubFetch(
      { body: { token: "ghs_tok" } },
      {
        body: {
          repositories: [
            { id: 1, full_name: "owner/private-repo", private: true, default_branch: "main" },
            { id: 2, full_name: "owner/public-repo", private: false, default_branch: "master" },
          ],
          total_count: 2,
        },
      }
    );

    const repos = await listInstallationRepos(42);

    expect(repos).toHaveLength(2);
    expect(repos[0]).toEqual({ id: 1, fullName: "owner/private-repo", private: true, defaultBranch: "main" });
    expect(repos[1]).toEqual({ id: 2, fullName: "owner/public-repo", private: false, defaultBranch: "master" });
  });

  it("paginates when first page returns 100 repos", async () => {
    const page1 = Array.from({ length: 100 }, (_, i) => ({
      id: i + 1,
      full_name: `owner/repo-${i + 1}`,
      private: true,
      default_branch: "main",
    }));
    const page2 = [{ id: 101, full_name: "owner/repo-101", private: false, default_branch: "main" }];

    stubFetch(
      { body: { token: "ghs_tok" } },                                  // token exchange
      { body: { repositories: page1, total_count: 101 } },             // page 1
      { body: { repositories: page2, total_count: 101 } }              // page 2
    );

    const repos = await listInstallationRepos(42);

    expect(repos).toHaveLength(101);
    expect(repos[100].fullName).toBe("owner/repo-101");
  });

  it("stops paginating when total_count is reached before 3 pages", async () => {
    const twoRepos = [
      { id: 1, full_name: "owner/repo-1", private: true, default_branch: "main" },
      { id: 2, full_name: "owner/repo-2", private: false, default_branch: "main" },
    ];

    stubFetch(
      { body: { token: "ghs_tok" } },
      { body: { repositories: twoRepos, total_count: 2 } }
    );

    const repos = await listInstallationRepos(42);

    // fetch called twice: token + one repos page
    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(2);
    expect(repos).toHaveLength(2);
  });

  it("returns partial results when a page fetch fails", async () => {
    const page1 = Array.from({ length: 100 }, (_, i) => ({
      id: i + 1, full_name: `owner/repo-${i + 1}`, private: false, default_branch: "main",
    }));

    stubFetch(
      { body: { token: "ghs_tok" } },
      { body: { repositories: page1, total_count: 200 } },   // page 1 ok
      { ok: false, status: 500 }                              // page 2 fails → loop breaks
    );

    const repos = await listInstallationRepos(42);
    expect(repos).toHaveLength(100);
  });
});

// ── verifyRepoAccess ──────────────────────────────────────────────────────────

describe("verifyRepoAccess", () => {
  it("returns true when the GitHub API returns 200", async () => {
    stubFetch(
      { body: { token: "ghs_tok" } },
      { ok: true, status: 200 }
    );

    const result = await verifyRepoAccess(42, "owner/repo");

    expect(result).toBe(true);
  });

  it("returns false when the GitHub API returns 404", async () => {
    stubFetch(
      { body: { token: "ghs_tok" } },
      { ok: false, status: 404 }
    );

    const result = await verifyRepoAccess(42, "owner/repo");

    expect(result).toBe(false);
  });

  it("returns false when the GitHub API returns 403 (app lacks access)", async () => {
    stubFetch(
      { body: { token: "ghs_tok" } },
      { ok: false, status: 403 }
    );

    const result = await verifyRepoAccess(42, "owner/repo");

    expect(result).toBe(false);
  });

  it("returns false when fetch throws (network error)", async () => {
    // Token exchange succeeds but the repo check throws
    let call = 0;
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => {
      call++;
      if (call === 1) return Promise.resolve({ ok: true, json: async () => ({ token: "ghs_tok" }), text: async () => "" });
      return Promise.reject(new Error("network error"));
    }));

    const result = await verifyRepoAccess(42, "owner/repo");

    expect(result).toBe(false);
  });

  it("calls the correct repo endpoint", async () => {
    stubFetch(
      { body: { token: "ghs_tok" } },
      { ok: true }
    );

    await verifyRepoAccess(42, "myorg/secret-repo");

    const lastCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.at(-1) as [string];
    expect(lastCall[0]).toBe("https://api.github.com/repos/myorg/secret-repo");
  });
});

// ── getInstallationInfo ───────────────────────────────────────────────────────

describe("getInstallationInfo", () => {
  it("returns targetLogin and targetType for a User installation", async () => {
    stubFetch({
      body: { account: { login: "octocat", type: "User" } },
    });

    const info = await getInstallationInfo(42);

    expect(info).toEqual({ targetLogin: "octocat", targetType: "User" });
  });

  it("returns targetLogin and targetType for an Organization installation", async () => {
    stubFetch({
      body: { account: { login: "my-org", type: "Organization" } },
    });

    const info = await getInstallationInfo(42);

    expect(info).toEqual({ targetLogin: "my-org", targetType: "Organization" });
  });

  it("calls the correct GitHub API endpoint", async () => {
    stubFetch({ body: { account: { login: "octocat", type: "User" } } });

    await getInstallationInfo(77);

    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    expect(url).toBe("https://api.github.com/app/installations/77");
  });

  it("throws when GitHub returns a non-ok response", async () => {
    stubFetch({ ok: false, status: 404 });

    await expect(getInstallationInfo(42)).rejects.toThrow();
  });
});
