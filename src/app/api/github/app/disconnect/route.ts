import { NextResponse } from "next/server";
import { auth } from "@/infrastructure/auth/auth";
import { PrismaGitHubInstallationRepository } from "@/infrastructure/database/repositories/PrismaGitHubInstallationRepository";
import { PrismaProjectRepository } from "@/infrastructure/database/repositories/PrismaProjectRepository";
import { disconnectGitHubInstallation } from "@/application/use-cases/DisconnectGitHubInstallation";
import { createLogger } from "@/infrastructure/logger";

const logger = createLogger("GitHubAppDisconnect");

/**
 * POST /api/github/app/disconnect
 *
 * Removes the GitHub App installation for the authenticated user and clears
 * the repoVerified flag on any projects that used it.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await disconnectGitHubInstallation(
      session.user.id,
      new PrismaGitHubInstallationRepository(),
      new PrismaProjectRepository()
    );

    logger.info({ userId: session.user.id }, "GitHub App disconnected");
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error({ err, userId: session.user.id }, "Failed to disconnect GitHub App");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
