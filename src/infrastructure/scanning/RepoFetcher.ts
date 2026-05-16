const MAX_ZIP_BYTES = 50 * 1024 * 1024;

export class RepoFetchError extends Error {}

type Provider = "github" | "gitlab" | "bitbucket";

type ParsedRepo = {
  provider: Provider;
  namespace: string;
  repo: string;
};

export function parseRepoUrl(url: string): ParsedRepo {
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    throw new RepoFetchError("Invalid repository URL");
  }

  const parts = u.pathname
    .replace(/^\//, "")
    .replace(/\/$/, "")
    .split("/")
    .filter(Boolean);

  if (u.hostname === "github.com" || u.hostname === "www.github.com") {
    if (parts.length < 2) {
      throw new RepoFetchError(
        "Invalid GitHub URL. Expected: https://github.com/owner/repo"
      );
    }
    return {
      provider: "github",
      namespace: parts[0],
      repo: parts[1].replace(/\.git$/, ""),
    };
  }

  if (u.hostname === "gitlab.com" || u.hostname === "www.gitlab.com") {
    // GitLab supports nested namespaces: owner/group/subgroup/repo
    if (parts.length < 2) {
      throw new RepoFetchError(
        "Invalid GitLab URL. Expected: https://gitlab.com/owner/repo"
      );
    }
    return {
      provider: "gitlab",
      namespace: parts.slice(0, -1).join("/"),
      repo: parts[parts.length - 1].replace(/\.git$/, ""),
    };
  }

  if (u.hostname === "bitbucket.org" || u.hostname === "www.bitbucket.org") {
    if (parts.length < 2) {
      throw new RepoFetchError(
        "Invalid Bitbucket URL. Expected: https://bitbucket.org/owner/repo"
      );
    }
    return {
      provider: "bitbucket",
      namespace: parts[0],
      repo: parts[1].replace(/\.git$/, ""),
    };
  }

  throw new RepoFetchError(
    "Unsupported repository host. Supported: github.com, gitlab.com, bitbucket.org"
  );
}

function buildRawFileUrl(parsed: ParsedRepo, branch: string): string {
  const { provider, namespace, repo } = parsed;
  switch (provider) {
    case "github":
      return `https://raw.githubusercontent.com/${namespace}/${repo}/${branch}/.owaspchecker`;
    case "gitlab":
      return `https://gitlab.com/${namespace}/${repo}/-/raw/${branch}/.owaspchecker`;
    case "bitbucket":
      return `https://bitbucket.org/${namespace}/${repo}/raw/${branch}/.owaspchecker`;
  }
}

function buildZipUrl(parsed: ParsedRepo, branch: string): string {
  const { provider, namespace, repo } = parsed;
  switch (provider) {
    case "github":
      return `https://github.com/${namespace}/${repo}/archive/refs/heads/${branch}.zip`;
    case "gitlab":
      return `https://gitlab.com/${namespace}/${repo}/-/archive/${branch}/${repo}-${branch}.zip`;
    case "bitbucket":
      return `https://bitbucket.org/${namespace}/${repo}/get/${branch}.zip`;
  }
}

export function buildVerificationUrls(repoUrl: string): { branch: string; url: string }[] {
  const parsed = parseRepoUrl(repoUrl);
  return ["main", "master"].map((branch) => ({
    branch,
    url: buildRawFileUrl(parsed, branch),
  }));
}

async function fetchZipFromUrl(url: string): Promise<Uint8Array | null> {
  const res = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(60_000),
    headers: { "User-Agent": "OwaspChecker/1.0" },
  });
  if (!res.ok) return null;

  const contentLength = res.headers.get("content-length");
  if (contentLength && parseInt(contentLength) > MAX_ZIP_BYTES) {
    throw new RepoFetchError("Repository ZIP exceeds the 50 MB limit");
  }

  const buffer = await res.arrayBuffer();
  if (buffer.byteLength > MAX_ZIP_BYTES) {
    throw new RepoFetchError("Repository ZIP exceeds the 50 MB limit");
  }
  return new Uint8Array(buffer);
}

export async function fetchRepoAsZip(repoUrl: string): Promise<Uint8Array> {
  const parsed = parseRepoUrl(repoUrl);

  for (const branch of ["main", "master"]) {
    const bytes = await fetchZipFromUrl(buildZipUrl(parsed, branch));
    if (bytes) return bytes;
  }

  throw new RepoFetchError(
    `Could not download repository "${parsed.namespace}/${parsed.repo}". ` +
      "The repository may be private, empty, or use a non-standard default branch."
  );
}
