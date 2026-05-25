import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { auth } from "@/infrastructure/auth/auth";

/**
 * GET /api/github/app/install
 *
 * Redirects the authenticated user to GitHub to install the GitHub App.
 * A signed CSRF state is stored in an httpOnly cookie to verify the callback.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const slug = process.env.GITHUB_APP_SLUG;
  if (!slug) {
    return NextResponse.json(
      { error: "GitHub App not configured on this server" },
      { status: 503 }
    );
  }

  // Generate CSRF state and sign it with AUTH_SECRET
  const state = crypto.randomUUID();
  const hmac = crypto
    .createHmac("sha256", process.env.AUTH_SECRET!)
    .update(state)
    .digest("hex");

  const installUrl = `https://github.com/apps/${slug}/installations/new?state=${state}`;

  const response = NextResponse.redirect(installUrl);
  response.cookies.set("gh_app_state", `${state}.${hmac}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes
    path: "/",
  });

  return response;
}
