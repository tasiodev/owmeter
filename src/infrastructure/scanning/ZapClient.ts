import type { RawFinding } from "@/domain/services/ScoringService";
import type { OWASPCategoryId } from "@/domain/value-objects/OWASPCategory";
import type { Severity } from "@/domain/value-objects/Severity";

const ZAP_URL = process.env.ZAP_URL ?? "http://localhost:8080";
const ZAP_API_KEY = process.env.ZAP_API_KEY ?? "changeme";

interface ZapAlert {
  alert: string;
  description: string;
  risk: string; // Informational | Low | Medium | High
  solution: string;
  reference: string;
  cweid: string;
  wascid: string;
  url: string;
  evidence: string;
}

function zapRiskToSeverity(risk: string): Severity {
  switch (risk.toLowerCase()) {
    case "high": return "HIGH";
    case "medium": return "MEDIUM";
    case "low": return "LOW";
    default: return "INFO";
  }
}

// Maps ZAP CWE IDs and WASC IDs to OWASP Top 10 categories
function mapToOWASPCategory(cweid: string, wascid: string, alertName: string): OWASPCategoryId {
  const cwe = parseInt(cweid, 10);
  const alert = alertName.toLowerCase();

  if ([89, 564, 943].includes(cwe) || alert.includes("sql injection")) return "A03_INJECTION";
  if ([79, 80, 87].includes(cwe) || alert.includes("xss") || alert.includes("cross-site scripting")) return "A03_INJECTION";
  if ([311, 319, 326, 327, 328].includes(cwe) || alert.includes("ssl") || alert.includes("tls") || alert.includes("https")) return "A02_CRYPTOGRAPHIC_FAILURES";
  if ([306, 307, 521, 522, 613].includes(cwe) || alert.includes("authentication") || alert.includes("password")) return "A07_AUTH_FAILURES";
  if ([918].includes(cwe) || alert.includes("ssrf")) return "A10_SSRF";
  if ([200, 497, 538].includes(cwe) || alert.includes("information disclosure") || alert.includes("server leaks")) return "A05_SECURITY_MISCONFIGURATION";
  if ([16, 614].includes(cwe) || alert.includes("cookie") || alert.includes("cors") || alert.includes("csp") || alert.includes("header")) return "A05_SECURITY_MISCONFIGURATION";
  if ([284, 285, 639].includes(cwe) || alert.includes("access control") || alert.includes("path traversal")) return "A01_BROKEN_ACCESS_CONTROL";

  return "A05_SECURITY_MISCONFIGURATION";
}

async function zapGet<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${ZAP_URL}/JSON/${path}`);
  url.searchParams.set("apikey", ZAP_API_KEY);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`ZAP API error ${res.status}: ${await res.text()}`);
  return res.json() as T;
}

async function pollUntilComplete(
  checkFn: () => Promise<number>,
  timeoutMs = 300_000,
  intervalMs = 5000
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const progress = await checkFn();
    if (progress >= 100) return;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error("ZAP scan timed out");
}

function buildEvidence(zapEvidence: string | undefined, urls: string[]): string | undefined {
  if (zapEvidence) return zapEvidence;
  return urls.length > 0 ? urls.join("\n") : undefined;
}

// ZAP runs inside Docker — translate localhost/127.0.0.1 to host.docker.internal
// so the container can reach services on the host machine.
function resolveZapTargetUrl(targetUrl: string): string {
  const url = new URL(targetUrl);
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
    url.hostname = "host.docker.internal";
  }
  return url.toString();
}

export async function runZapActiveScan(targetUrl: string): Promise<RawFinding[]> {
  const zapTargetUrl = resolveZapTargetUrl(targetUrl);

  // 1. Spider the target
  const spiderRes = await zapGet<{ scan: string }>("spider/action/scan", { url: zapTargetUrl, maxChildren: "3" });
  const spiderId = spiderRes.scan;

  await pollUntilComplete(async () => {
    const status = await zapGet<{ status: string }>("spider/view/status", { scanId: spiderId });
    return parseInt(status.status, 10);
  });

  // 2. Active scan
  const scanRes = await zapGet<{ scan: string }>("ascan/action/scan", {
    url: zapTargetUrl,
    recurse: "true",
    inScopeOnly: "true",
  });
  const scanId = scanRes.scan;

  await pollUntilComplete(async () => {
    const status = await zapGet<{ status: string }>("ascan/view/status", { scanId });
    return parseInt(status.status, 10);
  });

  // 3. Get alerts
  const alertsRes = await zapGet<{ alerts: ZapAlert[] }>("core/view/alerts", { baseurl: zapTargetUrl });
  const alerts = alertsRes.alerts ?? [];

  // 4. Clean up context
  await zapGet("core/action/deleteAllAlerts").catch(() => {});

  const targetHost = new URL(zapTargetUrl).hostname;

  function isSameDomainUrl(raw: string | undefined): boolean {
    if (!raw) return false;
    try {
      return new URL(raw).hostname === targetHost;
    } catch {
      return false;
    }
  }

  function extractResourceUrl(evidence: string | undefined): string | undefined {
    const match = evidence?.match(/(?:src|href)\s*=\s*["']?(https?:\/\/[^"'\s>]+)/i);
    return match?.[1];
  }

  function isFalsePositive(a: ZapAlert): boolean {
    const alert = a.alert.toLowerCase();

    // Cross-Domain JavaScript: only a problem when the script host differs from the target.
    if (alert.includes("cross-domain javascript")) {
      return isSameDomainUrl(extractResourceUrl(a.evidence));
    }

    // Sub Resource Integrity: only meaningful for cross-origin resources.
    if (alert.includes("sub resource integrity")) {
      const url = extractResourceUrl(a.evidence);
      // If we can't determine the resource URL, assume it's same-domain (Next.js inline/relative).
      if (!url) return true;
      return isSameDomainUrl(url);
    }

    // X-Powered-By: already detected by PassiveAnalyzer with the actual header value.
    if (alert.includes("x-powered-by")) return true;

    return false;
  }

  // Deduplicate by alert name: ZAP fires one alert per URL for the same issue type.
  // Keep the worst severity and collect up to 3 example URLs as evidence.
  const byAlert = new Map<string, { alert: ZapAlert; urls: string[] }>();
  for (const a of alerts) {
    if (a.risk.toLowerCase() === "informational" && !a.cweid) continue;
    if (isFalsePositive(a)) continue;
    const existing = byAlert.get(a.alert);
    if (!existing) {
      byAlert.set(a.alert, { alert: a, urls: [a.url].filter(Boolean) });
    } else {
      if (a.url && !existing.urls.includes(a.url) && existing.urls.length < 3) {
        existing.urls.push(a.url);
      }
      // Keep highest severity
      const ranks: Record<string, number> = { high: 3, medium: 2, low: 1, informational: 0 };
      if ((ranks[a.risk.toLowerCase()] ?? 0) > (ranks[existing.alert.risk.toLowerCase()] ?? 0)) {
        existing.alert = a;
      }
    }
  }

  return Array.from(byAlert.values()).map(({ alert: a, urls }): RawFinding => ({
    category: mapToOWASPCategory(a.cweid, a.wascid, a.alert),
    severity: zapRiskToSeverity(a.risk),
    title: a.alert,
    description: a.description,
    evidence: buildEvidence(a.evidence, urls),
  }));
}
