import { type NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { auth } from "@/infrastructure/auth/auth";
import { PrismaGitHubInstallationRepository } from "@/infrastructure/database/repositories/PrismaGitHubInstallationRepository";
import { connectGitHubInstallation } from "@/application/use-cases/ConnectGitHubInstallation";
import { getInstallationInfo } from "@/infrastructure/github/GitHubAppClient";
import { createLogger } from "@/infrastructure/logger";

const logger = createLogger("GitHubAppCallback");

/**
 * GET /api/github/app/callback?installation_id=...&setup_action=install&state=...
 *
 * Called by GitHub after the user installs (or updates) the GitHub App.
 * Verifies the CSRF state, stores the installation_id, and redirects to Settings.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const installationIdRaw = searchParams.get("installation_id");
  const setupAction = searchParams.get("setup_action");
  const state = searchParams.get("state");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const settingsUrl = `${appUrl}/dashboard/settings`;
  const errorUrl = `${settingsUrl}?error=github_connect_failed`;

  // ── 1. Auth check ─────────────────────────────────────────────────────────
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(`${appUrl}/login`);
  }

  // ── 2. CSRF verification ──────────────────────────────────────────────────
  const cookieValue = req.cookies.get("gh_app_state")?.value ?? "";
  const dotIndex = cookieValue.lastIndexOf(".");
  const storedState = cookieValue.slice(0, dotIndex);
  const storedHmac = cookieValue.slice(dotIndex + 1);

  const expectedHmac = crypto
    .createHmac("sha256", process.env.AUTH_SECRET!)
    .update(storedState)
    .digest("hex");

  const hmacMatch = (() => {
    try {
      if (!storedHmac || !expectedHmac) return false;
      const storedBuf = Buffer.from(storedHmac, "hex");
      const expectedBuf = Buffer.from(expectedHmac, "hex");
      if (storedBuf.length !== expectedBuf.length) return false;
      return crypto.timingSafeEqual(storedBuf, expectedBuf);
    } catch {
      return false;
    }
  })();

  if (!hmacMatch || storedState !== state) {
    logger.warn({ userId: session.user.id }, "GitHub App callback: CSRF state mismatch");
    const res = NextResponse.redirect(errorUrl);
    res.cookies.delete("gh_app_state");
    return res;
  }

  // ── 3. Validate parameters ────────────────────────────────────────────────
  if (!installationIdRaw || !["install", "update"].includes(setupAction ?? "")) {
    logger.warn({ setupAction, installationIdRaw }, "GitHub App callback: unexpected params");
    const res = NextResponse.redirect(errorUrl);
    res.cookies.delete("gh_app_state");
    return res;
  }

  const installationId = parseInt(installationIdRaw, 10);
  if (isNaN(installationId) || installationId <= 0) {
    const res = NextResponse.redirect(errorUrl);
    res.cookies.delete("gh_app_state");
    return res;
  }

  // ── 4. Store installation ─────────────────────────────────────────────────
  try {
    const repo = new PrismaGitHubInstallationRepository();
    await connectGitHubInstallation(
      session.user.id,
      installationId,
      getInstallationInfo,
      repo
    );

    logger.info({ userId: session.user.id, installationId }, "GitHub App connected");
  } catch (err) {
    logger.error({ err, userId: session.user.id }, "GitHub App callback: failed to connect");
    const res = NextResponse.redirect(errorUrl);
    res.cookies.delete("gh_app_state");
    return res;
  }

  const res = NextResponse.redirect(settingsUrl);
  res.cookies.delete("gh_app_state");
  return res;
}
