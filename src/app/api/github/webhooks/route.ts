import { type NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { PrismaGitHubInstallationRepository } from "@/infrastructure/database/repositories/PrismaGitHubInstallationRepository";
import { PrismaProjectRepository } from "@/infrastructure/database/repositories/PrismaProjectRepository";
import { createLogger } from "@/infrastructure/logger";

const logger = createLogger("GitHubWebhook");

/**
 * POST /api/github/webhooks
 *
 * Receives GitHub App webhook events. Currently handles:
 * - installation.deleted  → removes the installation record and clears linked project repos
 * - installation.suspend  → same cleanup (user suspended the app)
 */
export async function POST(req: NextRequest) {
  // ── 1. Verify webhook signature (HMAC-SHA256) ─────────────────────────────
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) {
    logger.error("GITHUB_WEBHOOK_SECRET is not set — rejecting all webhooks");
    return new NextResponse("Forbidden", { status: 403 });
  }

  const sig = req.headers.get("x-hub-signature-256");
  const body = await req.text();

  if (!sig) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const expected =
    "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("hex");

  // Constant-time comparison to prevent timing attacks
  try {
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expected);
    if (
      sigBuf.length !== expBuf.length ||
      !crypto.timingSafeEqual(sigBuf, expBuf)
    ) {
      logger.warn("GitHub webhook: invalid signature");
      return new NextResponse("Forbidden", { status: 403 });
    }
  } catch {
    return new NextResponse("Forbidden", { status: 403 });
  }

  // ── 2. Parse event ────────────────────────────────────────────────────────
  let payload: { action?: string; installation?: { id?: number } };
  try {
    payload = JSON.parse(body) as typeof payload;
  } catch {
    return new NextResponse("Bad Request", { status: 400 });
  }

  const event = req.headers.get("x-github-event");
  const { action, installation } = payload;

  logger.info({ event, action, installationId: installation?.id }, "GitHub webhook received");

  // ── 3. Handle installation.deleted / installation.suspend ─────────────────
  if (
    event === "installation" &&
    (action === "deleted" || action === "suspend") &&
    installation?.id
  ) {
    const installationId = installation.id;
    const installationRepo = new PrismaGitHubInstallationRepository();
    const projectRepo = new PrismaProjectRepository();

    // Clear private repo fields on linked projects first
    await projectRepo.clearPrivateReposByInstallation(installationId);
    // Then delete the installation record
    await installationRepo.deleteByInstallationId(installationId);

    logger.info({ installationId }, "GitHub App installation cleaned up after deletion");
  }

  return new NextResponse(null, { status: 204 });
}
