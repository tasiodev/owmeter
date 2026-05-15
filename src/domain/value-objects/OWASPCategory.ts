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

// Categories not evaluated in PASSIVE/FULL mode without source code
export const PASSIVE_UNEVALUATED: ReadonlySet<OWASPCategoryId> = new Set<OWASPCategoryId>([
  "A03_INJECTION",               // meaningful detection requires code (ZAP coverage too shallow)
  "A04_INSECURE_DESIGN",         // requires architecture/code review
  "A06_VULNERABLE_COMPONENTS",   // requires dependency manifests (package.json, etc.)
  "A08_DATA_INTEGRITY_FAILURES", // requires code/CI analysis
  "A09_LOGGING_FAILURES",        // requires code/system access
  "A10_SSRF",                    // meaningful detection requires code (ZAP coverage too shallow)
]);

// A05 checks HTTP headers, SSL certs, and server config — impossible to verify from source code alone
export const CODE_UNEVALUATED: ReadonlySet<OWASPCategoryId> = new Set<OWASPCategoryId>([
  "A05_SECURITY_MISCONFIGURATION",
]);

export function isEvaluated(category: OWASPCategoryId, mode: ScanMode): boolean {
  if (mode === "PASSIVE") return !PASSIVE_UNEVALUATED.has(category);
  if (mode === "CODE") return !CODE_UNEVALUATED.has(category);
  return true; // FULL covers both passive (server) + code analysis
}
