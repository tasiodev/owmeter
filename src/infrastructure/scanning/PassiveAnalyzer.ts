import type { RawFinding } from "@/domain/services/ScoringService";

const SENSITIVE_PATHS = [
  "/.env",
  "/.git/config",
  "/admin",
  "/wp-admin",
  "/phpMyAdmin",
  "/.well-known/security.txt",
];

const REQUIRED_SECURITY_HEADERS: Record<string, { description: string; missingFinding: Omit<RawFinding, "evidence"> }> = {
  "strict-transport-security": {
    description: "HSTS prevents protocol downgrade attacks",
    missingFinding: {
      category: "A02_CRYPTOGRAPHIC_FAILURES",
      severity: "HIGH",
      title: "Missing Strict-Transport-Security (HSTS) header",
      description: "The server does not set HSTS, leaving users vulnerable to SSL stripping attacks.",
    },
  },
  "content-security-policy": {
    description: "CSP mitigates XSS attacks",
    missingFinding: {
      category: "A05_SECURITY_MISCONFIGURATION",
      severity: "MEDIUM",
      title: "Missing Content-Security-Policy header",
      description: "No CSP header found. This increases the risk of XSS attacks.",
    },
  },
  "x-frame-options": {
    description: "Prevents clickjacking",
    missingFinding: {
      category: "A05_SECURITY_MISCONFIGURATION",
      severity: "MEDIUM",
      title: "Missing X-Frame-Options header",
      description: "The page can be embedded in iframes, enabling clickjacking attacks.",
    },
  },
  "x-content-type-options": {
    description: "Prevents MIME sniffing",
    missingFinding: {
      category: "A05_SECURITY_MISCONFIGURATION",
      severity: "LOW",
      title: "Missing X-Content-Type-Options header",
      description: "Browser may perform MIME-type sniffing, which can lead to XSS.",
    },
  },
  "referrer-policy": {
    description: "Controls referrer information",
    missingFinding: {
      category: "A05_SECURITY_MISCONFIGURATION",
      severity: "LOW",
      title: "Missing Referrer-Policy header",
      description: "Without a Referrer-Policy, sensitive URL data may leak to third parties.",
    },
  },
  "permissions-policy": {
    description: "Controls browser feature access",
    missingFinding: {
      category: "A05_SECURITY_MISCONFIGURATION",
      severity: "LOW",
      title: "Missing Permissions-Policy header",
      description: "No Permissions-Policy found. Browser features like camera/microphone are unrestricted.",
    },
  },
};

async function fetchWithRedirect(url: string, maxRedirects = 5): Promise<{ headers: Record<string, string>; status: number; finalUrl: string; redirectedToHttps: boolean }> {
  let currentUrl = url;
  let redirectedToHttps = false;

  for (let i = 0; i <= maxRedirects; i++) {
    const res = await fetch(currentUrl, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(10000),
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) break;
      const next = new URL(location, currentUrl).toString();
      if (currentUrl.startsWith("http://") && next.startsWith("https://")) {
        redirectedToHttps = true;
      }
      currentUrl = next;
      continue;
    }

    const headers: Record<string, string> = {};
    res.headers.forEach((value, key) => { headers[key.toLowerCase()] = value; });

    return { headers, status: res.status, finalUrl: currentUrl, redirectedToHttps };
  }

  throw new Error("Too many redirects");
}

async function checkSensitivePaths(baseUrl: string): Promise<RawFinding[]> {
  const findings: RawFinding[] = [];

  await Promise.allSettled(
    SENSITIVE_PATHS.map(async (path) => {
      try {
        const res = await fetch(`${baseUrl}${path}`, {
          method: "GET",
          redirect: "manual",
          signal: AbortSignal.timeout(5000),
        });
        if (res.status === 200) {
          findings.push({
            category: "A01_BROKEN_ACCESS_CONTROL",
            severity: "HIGH",
            title: `Sensitive path exposed: ${path}`,
            description: `The path ${path} returned HTTP 200, potentially exposing sensitive information.`,
            evidence: `GET ${baseUrl}${path} → 200`,
          });
        }
      } catch {
        // timeout or connection refused is fine
      }
    })
  );

  return findings;
}

function checkServerInfoLeak(headers: Record<string, string>): RawFinding[] {
  const findings: RawFinding[] = [];
  const leakyHeaders = ["server", "x-powered-by", "x-aspnet-version", "x-aspnetmvc-version"];

  for (const header of leakyHeaders) {
    if (headers[header]) {
      findings.push({
        category: "A05_SECURITY_MISCONFIGURATION",
        severity: "LOW",
        title: `Server information disclosed via ${header} header`,
        description: `The response includes the ${header} header, which reveals server technology information.`,
        evidence: `${header}: ${headers[header]}`,
      });
    }
  }

  // CORS wildcard is a deterministic header check — moved here from ZAP to guarantee consistency
  const acao = headers["access-control-allow-origin"];
  if (acao === "*") {
    findings.push({
      category: "A05_SECURITY_MISCONFIGURATION",
      severity: "MEDIUM",
      title: "CORS wildcard origin (Access-Control-Allow-Origin: *)",
      description: "The server allows requests from any origin. This disables same-origin protection and exposes APIs to any website.",
      evidence: `access-control-allow-origin: *`,
    });
  }

  return findings;
}

function checkCookieSecurity(headers: Record<string, string>): RawFinding[] {
  const findings: RawFinding[] = [];
  const setCookie = headers["set-cookie"];
  if (!setCookie) return findings;

  const cookies = setCookie.split(/,(?=[^ ])/).map((c) => c.trim());

  for (const cookie of cookies) {
    const lower = cookie.toLowerCase();
    const name = cookie.split("=")[0];

    if (!lower.includes("httponly")) {
      findings.push({
        category: "A07_AUTH_FAILURES",
        severity: "MEDIUM",
        title: `Cookie missing HttpOnly flag: ${name}`,
        description: "Cookie accessible via JavaScript. HttpOnly prevents XSS-based session theft.",
        evidence: cookie.substring(0, 200),
      });
    }
    if (!lower.includes("secure")) {
      findings.push({
        category: "A02_CRYPTOGRAPHIC_FAILURES",
        severity: "MEDIUM",
        title: `Cookie missing Secure flag: ${name}`,
        description: "Cookie transmitted over HTTP. The Secure flag ensures cookies are only sent over HTTPS.",
        evidence: cookie.substring(0, 200),
      });
    }
    if (!lower.includes("samesite")) {
      findings.push({
        category: "A07_AUTH_FAILURES",
        severity: "LOW",
        title: `Cookie missing SameSite attribute: ${name}`,
        description: "Missing SameSite attribute may allow CSRF attacks.",
        evidence: cookie.substring(0, 200),
      });
    }
  }

  return findings;
}

export async function runPassiveAnalysis(targetUrl: string): Promise<RawFinding[]> {
  const findings: RawFinding[] = [];

  const url = new URL(targetUrl);
  const baseUrl = `${url.protocol}//${url.host}`;

  // Check HTTP → HTTPS redirect
  if (url.protocol === "https:") {
    try {
      const httpBase = `http://${url.host}`;
      const { redirectedToHttps } = await fetchWithRedirect(httpBase, 3);
      if (!redirectedToHttps) {
        findings.push({
          category: "A02_CRYPTOGRAPHIC_FAILURES",
          severity: "HIGH",
          title: "HTTP not redirected to HTTPS",
          description: "The site does not redirect HTTP traffic to HTTPS, leaving users exposed to plaintext interception.",
          evidence: `http://${url.host} does not redirect to HTTPS`,
        });
      }
    } catch {
      // can't check, skip
    }
  }

  // Main request
  let headers: Record<string, string>;
  try {
    const result = await fetchWithRedirect(targetUrl);
    headers = result.headers;
  } catch (err) {
    throw new Error(`Target ${targetUrl} is not reachable: ${err instanceof Error ? err.message : "connection refused"}`);
  }

  // Security headers
  for (const [header, { missingFinding }] of Object.entries(REQUIRED_SECURITY_HEADERS)) {
    if (!headers[header]) {
      findings.push(missingFinding);
    }
  }

  // Cookie security
  findings.push(...checkCookieSecurity(headers));

  // Server info leak
  findings.push(...checkServerInfoLeak(headers));

  // Sensitive paths
  const pathFindings = await checkSensitivePaths(baseUrl);
  findings.push(...pathFindings);

  return findings;
}
