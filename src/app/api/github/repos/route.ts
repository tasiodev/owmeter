import { NextResponse } from "next/server";
import { auth } from "@/infrastructure/auth/auth";
import { PrismaGitHubInstallationRepository } from "@/infrastructure/database/repositories/PrismaGitHubInstallationRepository";
import { getAccessibleRepos } from "@/application/use-cases/GetAccessibleRepos";
import { listInstallationRepos } from "@/infrastructure/github/GitHubAppClient";

/**
 * GET /api/github/repos
 *
 * Returns the list of repositories accessible through the user's GitHub App installation.
 * Returns an empty array if the GitHub App is not connected.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const repos = await getAccessibleRepos(
    session.user.id,
    new PrismaGitHubInstallationRepository(),
    listInstallationRepos
  );

  return NextResponse.json({ repos });
}
