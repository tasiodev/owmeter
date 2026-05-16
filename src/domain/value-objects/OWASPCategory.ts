export const OWASP_CATEGORIES = {
  A01_BROKEN_ACCESS_CONTROL: {
    id: "A01_BROKEN_ACCESS_CONTROL",
    name: "A01:2021 Broken Access Control",
    maxPoints: 10,
    url: "https://owasp.org/Top10/A01_2021-Broken_Access_Control/",
  },
  A02_CRYPTOGRAPHIC_FAILURES: {
    id: "A02_CRYPTOGRAPHIC_FAILURES",
    name: "A02:2021 Cryptographic Failures",
    maxPoints: 15,
    url: "https://owasp.org/Top10/A02_2021-Cryptographic_Failures/",
  },
  A03_INJECTION: {
    id: "A03_INJECTION",
    name: "A03:2021 Injection",
    maxPoints: 8,
    url: "https://owasp.org/Top10/A03_2021-Injection/",
  },
  A04_INSECURE_DESIGN: {
    id: "A04_INSECURE_DESIGN",
    name: "A04:2021 Insecure Design",
    maxPoints: 10,
    url: "https://owasp.org/Top10/A04_2021-Insecure_Design/",
  },
  A05_SECURITY_MISCONFIGURATION: {
    id: "A05_SECURITY_MISCONFIGURATION",
    name: "A05:2021 Security Misconfiguration",
    maxPoints: 15,
    url: "https://owasp.org/Top10/A05_2021-Security_Misconfiguration/",
  },
  A06_VULNERABLE_COMPONENTS: {
    id: "A06_VULNERABLE_COMPONENTS",
    name: "A06:2021 Vulnerable & Outdated Components",
    maxPoints: 5,
    url: "https://owasp.org/Top10/A06_2021-Vulnerable_and_Outdated_Components/",
  },
  A07_AUTH_FAILURES: {
    id: "A07_AUTH_FAILURES",
    name: "A07:2021 Identification & Auth Failures",
    maxPoints: 10,
    url: "https://owasp.org/Top10/A07_2021-Identification_and_Authentication_Failures/",
  },
  A08_DATA_INTEGRITY_FAILURES: {
    id: "A08_DATA_INTEGRITY_FAILURES",
    name: "A08:2021 Software & Data Integrity Failures",
    maxPoints: 10,
    url: "https://owasp.org/Top10/A08_2021-Software_and_Data_Integrity_Failures/",
  },
  A09_LOGGING_FAILURES: {
    id: "A09_LOGGING_FAILURES",
    name: "A09:2021 Security Logging & Monitoring Failures",
    maxPoints: 15,
    url: "https://owasp.org/Top10/A09_2021-Security_Logging_and_Monitoring_Failures/",
  },
  A10_SSRF: {
    id: "A10_SSRF",
    name: "A10:2021 Server-Side Request Forgery",
    maxPoints: 2,
    url: "https://owasp.org/Top10/A10_2021-Server-Side_Request_Forgery_%28SSRF%29/",
  },
} as const;

export type OWASPCategoryId = keyof typeof OWASP_CATEGORIES;

export const MAX_SCORE = 100;

// Scan mode reflects what analysis was performed
export type ScanMode = "PASSIVE" | "FULL" | "CODE";

// Categories not evaluated in PASSIVE mode (domain + ZAP only, no source code).
export const PASSIVE_UNEVALUATED: ReadonlySet<OWASPCategoryId> = new Set<OWASPCategoryId>([
  "A04_INSECURE_DESIGN",         // requires architecture/code review
  "A06_VULNERABLE_COMPONENTS",   // requires dependency manifests (package.json, etc.)
  "A08_DATA_INTEGRITY_FAILURES", // requires code/CI analysis
  "A09_LOGGING_FAILURES",        // requires code/system access
]);

// Categories only PARTIALLY evaluable in PASSIVE mode (domain + ZAP, no source code).
// ZAP and PassiveAnalyzer cover the externally visible surface; code is needed to close the gaps.
export const PASSIVE_PARTIAL: ReadonlySet<OWASPCategoryId> = new Set<OWASPCategoryId>([
  "A01_BROKEN_ACCESS_CONTROL",  // ZAP: path traversal + 6 sensitive paths; code: RBAC, auth middleware, IDOR
  "A02_CRYPTOGRAPHIC_FAILURES", // ZAP+passive: HTTPS/HSTS/TLS/Secure-cookie; code: MD5/SHA-1/JWT algo choice
  "A03_INJECTION",              // ZAP: SQL/XSS payloads on public endpoints; code: parameterized queries everywhere
  "A07_AUTH_FAILURES",          // passive: cookie flags; ZAP: brute-force/session; code: JWT secret, bcrypt
  "A10_SSRF",                   // ZAP: probes on discovered inputs; code: all internal URL fetches
]);

// A05 checks HTTP headers, SSL certs, and server config — impossible to verify from source code alone
export const CODE_UNEVALUATED: ReadonlySet<OWASPCategoryId> = new Set<OWASPCategoryId>([
  "A05_SECURITY_MISCONFIGURATION",
]);

// These categories are only PARTIALLY evaluable from source code alone.
// The code-checkable aspects are covered, but server-side runtime checks require a live domain.
export const CODE_PARTIAL: ReadonlySet<OWASPCategoryId> = new Set<OWASPCategoryId>([
  "A01_BROKEN_ACCESS_CONTROL",  // code: CORS wildcard patterns only; runtime: path traversal, IDOR, missing auth
  "A02_CRYPTOGRAPHIC_FAILURES", // code: weak crypto, hardcoded secrets, web storage tokens; server: TLS/HTTPS config
  "A07_AUTH_FAILURES",          // code: auth logic, password hashing; server: cookie flags (HttpOnly, Secure, SameSite)
]);

export type EvaluationLevel = "full" | "partial" | "none";

export function evaluationLevel(category: OWASPCategoryId, mode: ScanMode): EvaluationLevel {
  if (mode === "PASSIVE") {
    if (PASSIVE_UNEVALUATED.has(category)) return "none";
    if (PASSIVE_PARTIAL.has(category)) return "partial";
    return "full";
  }
  if (mode === "CODE") {
    if (CODE_UNEVALUATED.has(category)) return "none";
    if (CODE_PARTIAL.has(category)) return "partial";
    return "full";
  }
  return "full"; // FULL covers both passive (server) + code analysis
}

// partial counts as evaluated for backwards-compat callers
export function isEvaluated(category: OWASPCategoryId, mode: ScanMode): boolean {
  return evaluationLevel(category, mode) !== "none";
}
