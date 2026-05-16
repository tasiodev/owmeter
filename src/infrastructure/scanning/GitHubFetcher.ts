// Thin wrapper kept for backward compatibility. New code should use RepoFetcher.ts.
import { RepoFetchError, parseRepoUrl, fetchRepoAsZip } from "./RepoFetcher";

export { RepoFetchError as GitHubFetchError };

const GITHUB_URL_PATTERN = /^https:\/\/github\.com\/([^/]+)\/([^/?#]+)/;

export function parseGitHubUrl(url: string): { owner: string; repo: string } {
  const match = url.trim().match(GITHUB_URL_PATTERN);
  if (!match) {
    throw new RepoFetchError(
      "Invalid GitHub URL. Expected format: https://github.com/owner/repo"
    );
  }
  return { owner: match[1], repo: match[2].replace(/\.git$/, "") };
}

export async function fetchGitHubRepoAsZip(repoUrl: string): Promise<Uint8Array> {
  // Validate it's a GitHub URL before delegating
  parseGitHubUrl(repoUrl);
  // Re-parse through the unified fetcher (same logic, same URLs)
  const parsed = parseRepoUrl(repoUrl);
  void parsed; // already validated above
  return fetchRepoAsZip(repoUrl);
}
