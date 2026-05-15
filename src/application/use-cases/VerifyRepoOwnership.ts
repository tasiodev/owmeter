import type { IProjectRepository } from "@/domain/repositories/IProjectRepository";
import type { Project } from "@/domain/entities/Project";

export class RepoVerificationError extends Error {}

function parseGitHubRepoUrl(repoUrl: string): { owner: string; repo: string } {
  try {
    const url = new URL(repoUrl);
    if (url.hostname !== "github.com") throw new Error();
    const parts = url.pathname.replace(/^\//, "").replace(/\/$/, "").split("/");
    if (parts.length < 2 || !parts[0] || !parts[1]) throw new Error();
    return { owner: parts[0], repo: parts[1].replace(/\.git$/, "") };
  } catch {
    throw new RepoVerificationError("Invalid GitHub repository URL");
  }
}

async function checkRepoFile(repoUrl: string, token: string): Promise<boolean> {
  const { owner, repo } = parseGitHubRepoUrl(repoUrl);

  // Try main and master branches
  const branches = ["main", "master"];
  const expected = `owaspchecker-verify=${token}`;

  for (const branch of branches) {
    try {
      const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/.owaspchecker`;
      const res = await fetch(rawUrl, { signal: AbortSignal.timeout(10000) });
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

  if (!project) throw new RepoVerificationError("Project not found");
  if (project.userId !== requestingUserId) throw new RepoVerificationError("Unauthorized");
  if (project.repoVerified) return project;

  // Validate GitHub URL before attempting verification
  parseGitHubRepoUrl(repoUrl);

  if (!project.repoVerificationToken) {
    throw new RepoVerificationError("Project has no repo verification token");
  }

  const verified = await checkRepoFile(repoUrl, project.repoVerificationToken);

  if (!verified) {
    throw new RepoVerificationError(
      "Verification failed. Ensure the .owaspchecker file exists at the root of your repository with the correct content."
    );
  }

  return repo.markRepoVerified(projectId, repoUrl);
}
