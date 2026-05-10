const GITHUB_URL_PATTERN = /^https:\/\/github\.com\/([^/]+)\/([^/?#]+)/;
const MAX_ZIP_BYTES = 50 * 1024 * 1024;

export class GitHubFetchError extends Error {}

export function parseGitHubUrl(url: string): { owner: string; repo: string } {
  const match = url.trim().match(GITHUB_URL_PATTERN);
  if (!match) {
    throw new GitHubFetchError(
      "Invalid GitHub URL. Expected format: https://github.com/owner/repo"
    );
  }
  return { owner: match[1], repo: match[2].replace(/\.git$/, "") };
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
    throw new GitHubFetchError("Repository ZIP exceeds the 50 MB limit");
  }

  const buffer = await res.arrayBuffer();
  if (buffer.byteLength > MAX_ZIP_BYTES) {
    throw new GitHubFetchError("Repository ZIP exceeds the 50 MB limit");
  }
  return new Uint8Array(buffer);
}

export async function fetchGitHubRepoAsZip(githubUrl: string): Promise<Uint8Array> {
  const { owner, repo } = parseGitHubUrl(githubUrl);

  const mainUrl = `https://github.com/${owner}/${repo}/archive/refs/heads/main.zip`;
  const masterUrl = `https://github.com/${owner}/${repo}/archive/refs/heads/master.zip`;

  let bytes = await fetchZipFromUrl(mainUrl);
  if (!bytes) {
    bytes = await fetchZipFromUrl(masterUrl);
  }

  if (!bytes) {
    throw new GitHubFetchError(
      `Could not download repository "${owner}/${repo}". The repository may be private, empty, or have a non-standard default branch.`
    );
  }

  return bytes;
}
