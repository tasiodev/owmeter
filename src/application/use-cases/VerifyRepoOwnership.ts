import type { IProjectRepository } from "@/domain/repositories/IProjectRepository";
import type { Project } from "@/domain/entities/Project";
import { parseRepoUrl, buildVerificationUrls, RepoFetchError } from "@/infrastructure/scanning/RepoFetcher";

export { RepoFetchError as RepoVerificationError };

async function checkRepoFile(repoUrl: string, token: string): Promise<boolean> {
  const candidates = buildVerificationUrls(repoUrl);
  const expected = `owmeter-verify=${token}`;

  for (const { url } of candidates) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) continue;
      const text = await res.text();
      if (text.trim() === expected) return true;
    } catch {
      continue;
    }
  }
  return false;
}

export async function verifyRepoOwnership(
  projectId: string,
  requestingUserId: string,
  repoUrl: string,
  repo: IProjectRepository
): Promise<Project> {
  const project = await repo.findById(projectId);

  if (!project) throw new RepoFetchError("Project not found");
  if (project.userId !== requestingUserId) throw new RepoFetchError("Unauthorized");
  if (project.repoVerified) return project;

  // Validates URL and throws RepoFetchError for unsupported/malformed URLs
  parseRepoUrl(repoUrl);

  if (!project.repoVerificationToken) {
    throw new RepoFetchError("Project has no repo verification token");
  }

  const verified = await checkRepoFile(repoUrl, project.repoVerificationToken);

  if (!verified) {
    throw new RepoFetchError(
      "Verification failed. Ensure the .owmeter file exists at the root of your repository with the correct content."
    );
  }

  return repo.markRepoVerified(projectId, repoUrl);
}
