import crypto from "node:crypto";
import { createLogger } from "@/infrastructure/logger";
import type { GitHubRepo } from "@/domain/entities/GitHubInstallation";

const logger = createLogger("GitHubAppClient");

// ─── JWT (authenticates as the GitHub App itself) ─────────────────────────────

function createAppJWT(): string {
  const pemBase64 = process.env.GITHUB_APP_PRIVATE_KEY;
  const appId = process.env.GITHUB_APP_ID;

  if (!pemBase64 || !appId) {
    throw new Error("GITHUB_APP_PRIVATE_KEY and GITHUB_APP_ID env vars are required");
  }

  const pem = Buffer.from(pemBase64, "base64").toString("utf-8");
  const now = Math.floor(Date.now() / 1000);

  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({ iat: now - 60, exp: now + 600, iss: appId })
  ).toString("base64url");

  const unsigned = `${header}.${payload}`;
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(unsigned);
  const signature = sign.sign(pem, "base64url");

  return `${unsigned}.${signature}`;
}

// ─── Installation access token (short-lived, 1 hour, NEVER persisted) ─────────

export async function getInstallationToken(installationId: number): Promise<string> {
  const jwt = createAppJWT();

  const res = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "Owmeter/1.0",
      },
      signal: AbortSignal.timeout(10_000),
    }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    logger.error({ installationId, status: res.status }, "Failed to get installation token");
    throw new Error(`GitHub App token exchange failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { token: string };
  return data.token;
}

// ─── List repos accessible to an installation ────────────────────────────────

export async function listInstallationRepos(installationId: number): Promise<GitHubRepo[]> {
  const token = await getInstallationToken(installationId);

  const repos: GitHubRepo[] = [];
  let page = 1;

  // Paginate up to 300 repos to avoid timeouts
  while (page <= 3) {
    const res = await fetch(
      `https://api.github.com/installation/repositories?per_page=100&page=${page}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "Owmeter/1.0",
        },
        signal: AbortSignal.timeout(10_000),
      }
    );

    if (!res.ok) break;

    const data = (await res.json()) as {
      repositories: Array<{
        id: number;
        full_name: string;
        private: boolean;
        default_branch: string;
      }>;
      total_count: number;
    };

    for (const r of data.repositories) {
      repos.push({
        id: r.id,
        fullName: r.full_name,
        private: r.private,
        defaultBranch: r.default_branch,
      });
    }

    if (repos.length >= data.total_count || data.repositories.length < 100) break;
    page++;
  }

  return repos;
}

// ─── Verify a specific repo is accessible in an installation ─────────────────

export async function verifyRepoAccess(
  installationId: number,
  repoFullName: string
): Promise<boolean> {
  try {
    const token = await getInstallationToken(installationId);
    const res = await fetch(`https://api.github.com/repos/${repoFullName}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "Owmeter/1.0",
      },
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ─── Get installation metadata (owner login + type) ──────────────────────────

export async function getInstallationInfo(
  installationId: number
): Promise<{ targetLogin: string; targetType: string }> {
  const jwt = createAppJWT();

  const res = await fetch(
    `https://api.github.com/app/installations/${installationId}`,
    {
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "Owmeter/1.0",
      },
      signal: AbortSignal.timeout(10_000),
    }
  );

  if (!res.ok) {
    throw new Error(`Could not fetch installation info (${res.status})`);
  }

  const data = (await res.json()) as {
    account: { login: string; type: string };
  };

  return {
    targetLogin: data.account.login,
    targetType: data.account.type, // "User" or "Organization"
  };
}
