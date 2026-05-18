// Shared cookie-security helpers used by both PassiveAnalyzer and ZapClient.
// Keep both callers in sync: if you change these patterns, both detectors update.

const SENSITIVE_COOKIE_PATTERNS: RegExp[] = [
  /session/i,       // session, user_session, sessionId
  /\bsess\b/i,      // sess (standalone abbreviation)
  /\bsid\b/i,       // sid (session id)
  /token/i,         // access_token, refresh_token, auth_token, id_token
  /\bjwt\b/i,       // jwt
  /auth/i,          // auth, authToken, auth_cookie
  /credential/i,    // credential, credentials
  /\blogin\b/i,     // login
  /bearer/i,        // bearer
];

/**
 * Returns true only for cookies whose names suggest they carry session or auth
 * data. HttpOnly protects against XSS-based token theft — it is irrelevant for
 * preference/analytics cookies (locale, theme, _ga …) that are intentionally
 * JavaScript-readable.
 */
export function cookieNeedsHttpOnly(name: string): boolean {
  const lower = name.toLowerCase();
  if (lower.startsWith("__secure-") || lower.startsWith("__host-")) return true;
  if (lower.startsWith("next-auth") || lower.startsWith("next_auth")) return true;
  return SENSITIVE_COOKIE_PATTERNS.some((p) => p.test(lower));
}
