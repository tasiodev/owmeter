import createIntlMiddleware from "next-intl/middleware";
import { auth } from "@/infrastructure/auth/auth";
import { routing } from "@/i18n/routing";
import { NextRequest, NextResponse } from "next/server";

const intlProxy = createIntlMiddleware(routing);

function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    // 'strict-dynamic' lets nonce'd scripts load further scripts dynamically.
    // 'unsafe-inline' is ignored by browsers that support nonces + strict-dynamic;
    // it only serves as a fallback for CSP Level 1 browsers.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https://avatars.githubusercontent.com https://lh3.googleusercontent.com",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Pass API and static paths through unchanged (no CSP needed for JSON responses)
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

  // Generate a per-request nonce and inject it + the CSP into request headers.
  // next-intl's middleware calls `new Headers(request.headers)` internally, so
  // these headers are forwarded to Server Components via NextResponse.next().
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce);
  const patchedHeaders = new Headers(req.headers);
  patchedHeaders.set("x-nonce", nonce);
  patchedHeaders.set("Content-Security-Policy", csp);
  const patchedReq = new NextRequest(req, { headers: patchedHeaders });

  // Let next-intl handle locale routing/detection
  const response = intlProxy(patchedReq);

  // Set CSP on the browser-facing response header
  response.headers.set("Content-Security-Policy", csp);

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
    {
      // Match all paths except API routes, Next.js internals, and static files.
      // Exclude prefetch requests so cached prefetched pages don't carry a stale nonce.
      source: "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
