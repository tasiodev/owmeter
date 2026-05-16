import createIntlMiddleware from "next-intl/middleware";
import { auth } from "@/infrastructure/auth/auth";
import { routing } from "@/i18n/routing";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const intlProxy = createIntlMiddleware(routing);

export async function proxy(req: NextRequest) {
  // Strip internal port from host header so next-intl builds clean redirect URLs.
  // Cloudflare Tunnel / Coolify proxies can leak the container port (e.g. :3000).
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) {
    const { host, protocol } = new URL(appUrl);
    req.headers.set("host", host);
    req.headers.set("x-forwarded-host", host);
    req.headers.set("x-forwarded-proto", protocol.replace(":", ""));
  }

  const { pathname } = req.nextUrl;

  // Pass API and static paths through unchanged
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  // Auth check for dashboard routes (any locale)
  const isDashboard = /^\/(en|es)\/dashboard/.test(pathname);

  if (isDashboard) {
    const session = await auth();
    if (!session?.user?.id) {
      const locale = pathname.split("/")[1] ?? "en";
      const loginUrl = new URL(`/${locale}/login`, req.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Let next-intl handle locale routing/detection
  return intlProxy(req);
}

export const config = {
  matcher: [
    // Match everything except API, _next static, and files with extensions
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
