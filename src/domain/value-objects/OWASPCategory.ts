export const OWASP_CATEGORIES = {
  A01_BROKEN_ACCESS_CONTROL: {
    id: "A01_BROKEN_ACCESS_CONTROL",
    name: "A01:2021 Broken Access Control",
    maxPoints: 10,
  },
  A02_CRYPTOGRAPHIC_FAILURES: {
    id: "A02_CRYPTOGRAPHIC_FAILURES",
    name: "A02:2021 Cryptographic Failures",
    maxPoints: 15,
  },
  A03_INJECTION: {
    id: "A03_INJECTION",
    name: "A03:2021 Injection",
    maxPoints: 8,
  },
  A04_INSECURE_DESIGN: {
    id: "A04_INSECURE_DESIGN",
    name: "A04:2021 Insecure Design",
    maxPoints: 0, // code-only, V2
  },
  A05_SECURITY_MISCONFIGURATION: {
    id: "A05_SECURITY_MISCONFIGURATION",
    name: "A05:2021 Security Misconfiguration",
    maxPoints: 15,
  },
  A06_VULNERABLE_COMPONENTS: {
    id: "A06_VULNERABLE_COMPONENTS",
    name: "A06:2021 Vulnerable & Outdated Components",
    maxPoints: 5,
  },
  A07_AUTH_FAILURES: {
    id: "A07_AUTH_FAILURES",
    name: "A07:2021 Identification & Auth Failures",
    maxPoints: 10,
  },
  A08_DATA_INTEGRITY_FAILURES: {
    id: "A08_DATA_INTEGRITY_FAILURES",
    name: "A08:2021 Software & Data Integrity Failures",
    maxPoints: 0, // code-only, V2
  },
  A09_LOGGING_FAILURES: {
    id: "A09_LOGGING_FAILURES",
    name: "A09:2021 Security Logging & Monitoring Failures",
    maxPoints: 0, // code-only, V2
  },
  A10_SSRF: {
    id: "A10_SSRF",
    name: "A10:2021 Server-Side Request Forgery",
    maxPoints: 2,
  },
} as const;

export type OWASPCategoryId = keyof typeof OWASP_CATEGORIES;

export const MAX_SCORE_WITHOUT_CODE = Object.values(OWASP_CATEGORIES).reduce(
  (sum, c) => sum + c.maxPoints,
  0
);
