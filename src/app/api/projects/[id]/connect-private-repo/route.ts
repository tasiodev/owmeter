import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/infrastructure/auth/auth";
import { PrismaProjectRepository } from "@/infrastructure/database/repositories/PrismaProjectRepository";
import { PrismaGitHubInstallationRepository } from "@/infrastructure/database/repositories/PrismaGitHubInstallationRepository";
import { linkPrivateRepo, LinkPrivateRepoError } from "@/application/use-cases/LinkPrivateRepo";
import { verifyRepoAccess } from "@/infrastructure/github/GitHubAppClient";

const schema = z.object({
  repoFullName: z.string().regex(/^[\w.-]+\/[\w.-]+$/, "Expected format: owner/repo"),
});

/**
 * POST /api/projects/:id/connect-private-repo
 *
 * Links a private GitHub repository (accessible via the user's GitHub App installation)
 * to a project, marking it as repo-verified without requiring a .owmeter file.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { id } = await params;

  try {
    const project = await linkPrivateRepo(
      id,
      session.user.id,
      parsed.data.repoFullName,
      new PrismaProjectRepository(),
      new PrismaGitHubInstallationRepository(),
      verifyRepoAccess
    );

    return NextResponse.json(project);
  } catch (err) {
    if (err instanceof LinkPrivateRepoError) {
      return NextResponse.json(
        { error: "LINK_FAILED", message: (err as Error).message },
        { status: 400 }
      );
    }
    throw err;
  }
}
