import createIntlMiddleware from "next-intl/middleware";
import { auth } from "@/infrastructure/auth/auth";
import { routing } from "@/i18n/routing";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const intlProxy = createIntlMiddleware(routing);

export async function proxy(req: NextRequest) {
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
  const response = intlProxy(req);

  // next-intl redirects can include the internal port (e.g. :3000) when the
  // app runs behind a proxy with x-forwarded-proto:https. Rewrite the Location
  // header using NEXT_PUBLIC_APP_URL so the browser sees the correct public URL.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl && response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location");
    if (location) {
      try {
        const locUrl = new URL(location);
        const baseUrl = new URL(appUrl);
        locUrl.protocol = baseUrl.protocol;
        locUrl.hostname = baseUrl.hostname;
        locUrl.port = baseUrl.port;
        return NextResponse.redirect(locUrl.toString(), { status: response.status });
      } catch {
        return response;
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    // Match everything except API, _next static, and files with extensions
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
