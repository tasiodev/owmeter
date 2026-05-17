import pino from "pino";
import type { RawFinding } from "@/domain/services/ScoringService";
import type { OWASPCategoryId } from "@/domain/value-objects/OWASPCategory";
import type { Severity } from "@/domain/value-objects/Severity";

const logger = pino({ name: "ZapClient" });

const ZAP_URL = process.env.ZAP_URL ?? "http://localhost:8050";
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
  logger.info({ targetUrl, zapTargetUrl }, "ZAP scan starting");

  // 1. Spider the target
  const spiderRes = await zapGet<{ scan: string }>("spider/action/scan", {
    url: zapTargetUrl,
    maxChildren: "10",
    maxDuration: "2", // minutes; prevents runaway crawls
  });
  const spiderId = spiderRes.scan;
  logger.info({ spiderId }, "Spider started");

  await pollUntilComplete(async () => {
    const status = await zapGet<{ status: string }>("spider/view/status", { scanId: spiderId });
    const pct = parseInt(status.status, 10);
    logger.info({ spiderId, pct }, "Spider progress");
    return pct;
  });

  const spiderResults = await zapGet<{ results: string[] }>("spider/view/results", { scanId: spiderId });
  const discoveredUrls = spiderResults.results ?? [];
  logger.info(
    { urlCount: discoveredUrls.length, urls: discoveredUrls },
    "Spider complete — URLs discovered"
  );

  // 2. Log which active scan rules are enabled (shows injection, XSS, etc.)
  const scannersRes = await zapGet<{ scanners: Array<{ id: string; name: string; enabled: string; attackStrength: string }> }>(
    "ascan/view/scanners"
  );
  const enabledScanners = (scannersRes.scanners ?? []).filter((s) => s.enabled === "true");
  logger.info(
    {
      totalEnabled: enabledScanners.length,
      scanners: enabledScanners.map((s) => ({ id: s.id, name: s.name, strength: s.attackStrength })),
    },
    "Active scan rules enabled"
  );

  // 3. Active scan
  const scanRes = await zapGet<{ scan: string }>("ascan/action/scan", {
    url: zapTargetUrl,
    recurse: "true",
    inScopeOnly: "true",
  });
  const scanId = scanRes.scan;
  logger.info({ scanId }, "Active scan started");

  await pollUntilComplete(async () => {
    const status = await zapGet<{ status: string }>("ascan/view/status", { scanId });
    const pct = parseInt(status.status, 10);
    logger.info({ scanId, pct }, "Active scan progress");
    return pct;
  });
  logger.info({ scanId }, "Active scan complete");

  // 4. Get alerts
  const alertsRes = await zapGet<{ alerts: ZapAlert[] }>("core/view/alerts", { baseurl: zapTargetUrl });
  const alerts = alertsRes.alerts ?? [];
  logger.info(
    {
      rawAlertCount: alerts.length,
      alerts: alerts.map((a) => ({
        alert: a.alert,
        risk: a.risk,
        cweid: a.cweid,
        wascid: a.wascid,
        url: a.url,
      })),
    },
    "Raw ZAP alerts retrieved"
  );

  // 5. Clean up context
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

  // CDNs that serve dynamically-versioned scripts — SRI hashes are never published for these.
  const DYNAMIC_CDN_HOSTS = [
    "googlesyndication.com",
    "googletagmanager.com",
    "google-analytics.com",
    "googletagservices.com",
    "doubleclick.net",
    "connect.facebook.net",
    "static.hotjar.com",
  ];

  function isDynamicCdnUrl(raw: string | undefined): boolean {
    if (!raw) return false;
    try {
      const host = new URL(raw).hostname;
      return DYNAMIC_CDN_HOSTS.some((cdn) => host === cdn || host.endsWith(`.${cdn}`));
    } catch {
      return false;
    }
  }

  function isFalsePositive(a: ZapAlert): boolean {
    const alert = a.alert.toLowerCase();

    // Cross-Domain JavaScript: only a problem when the script host differs from the target.
    if (alert.includes("cross-domain javascript")) {
      return isSameDomainUrl(extractResourceUrl(a.evidence));
    }

    // Sub Resource Integrity: only meaningful for cross-origin resources that publish stable hashes.
    // Dynamic CDNs (AdSense, GTM, etc.) change content continuously — SRI is not applicable.
    if (alert.includes("sub resource integrity")) {
      const url = extractResourceUrl(a.evidence);
      if (!url) return true; // can't determine URL → assume same-domain (Next.js inline/relative)
      return isSameDomainUrl(url) || isDynamicCdnUrl(url);
    }

    // X-Powered-By: already detected by PassiveAnalyzer with the actual header value.
    if (alert.includes("x-powered-by")) return true;

    // Timestamp Disclosure: a Unix epoch number in content is not a vulnerability by itself.
    if (alert.includes("timestamp disclosure")) return true;

    // Content-Type on redirect responses: 3xx responses have no body — Content-Type is irrelevant.
    if (alert.includes("content-type") && a.url) {
      // ZAP evidence for redirect CT alerts typically lacks a body; risk is always Informational/Low.
      if (a.risk.toLowerCase() === "informational" || a.risk.toLowerCase() === "low") return true;
    }

    return false;
  }

  // Deduplicate by resolved title (not raw alert name) so each distinct vulnerable library gets its own entry.
  // Keep the worst severity and collect up to 3 example URLs as evidence.
  const byAlert = new Map<string, { alert: ZapAlert; urls: string[] }>();
  for (const a of alerts) {
    if (a.risk.toLowerCase() === "informational" && !a.cweid) continue;
    const fp = isFalsePositive(a);
    if (fp) {
      logger.debug({ alert: a.alert, url: a.url }, "Filtered as false positive");
      continue;
    }
    // For vulnerable library alerts, key by resolved title so jquery@1.x and lodash@4.x are separate entries.
    const dedupeKey = a.alert.toLowerCase().includes("vulnerable js library")
      ? (a.description.match(/identified library\s+(.+?)\s+-\s+([\d.]+)\s+appears/i)?.[0] ?? a.alert)
      : a.alert;
    const existing = byAlert.get(dedupeKey);
    if (!existing) {
      byAlert.set(dedupeKey, { alert: a, urls: [a.url].filter(Boolean) });
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

  // Retire.js description: "The identified library <name> - <version> appears to be vulnerable to: ..."
  function resolveTitle(alert: string, description: string): string {
    if (!alert.toLowerCase().includes("vulnerable js library")) return alert;
    const match = description.match(/identified library\s+(.+?)\s+-\s+([\d.]+)\s+appears/i);
    if (match) return `Vulnerable JS Library: ${match[1].trim()} ${match[2]}`;
    return alert;
  }

  // ZAP emits the same generic CSP paragraph for every CSP sub-alert.
  // Replace with specific, actionable descriptions per alert type.
  const CSP_DESCRIPTIONS: Record<string, string> = {
    "csp: script-src unsafe-inline":
      "'unsafe-inline' in script-src allows any inline <script> tag to execute, effectively disabling XSS protection. " +
      "Fix: add 'strict-dynamic' alongside a per-request nonce ('nonce-{random}') — CSP3-capable browsers then ignore 'unsafe-inline' automatically, " +
      "while older browsers fall back to it. This approach is compatible with Google AdSense and GTM. " +
      "Next.js supports nonce injection via middleware.",
    "csp: script-src unsafe-eval":
      "'unsafe-eval' permits eval(), new Function(), and setTimeout(string), which can be exploited to run injected code. " +
      "It is often required by Google Tag Manager's preview mode or legacy AdSense snippets. " +
      "Fix: migrate GTM tags to Custom Templates (which avoid eval) and test whether AdSense still works without it. " +
      "Combined with 'strict-dynamic' + nonces, many sites can drop 'unsafe-eval' entirely.",
    "csp: style-src unsafe-inline":
      "'unsafe-inline' in style-src allows arbitrary inline styles, which can be abused for CSS injection attacks (data exfiltration via attribute selectors). " +
      "Fix: add a nonce to inline <style> tags, or hash individual inline style blocks with 'sha256-<hash>'. " +
      "CSS-in-JS libraries (e.g. styled-components) support nonce injection via their server-side rendering APIs.",
    "csp: wildcard directive":
      "A wildcard or overly broad source (e.g. 'https:' in img-src) allows resources from any HTTPS origin. " +
      "For images the practical risk is low, but it weakens defence-in-depth. " +
      "Fix: enumerate the specific domains you load images from (CDN, user avatars, analytics pixel hosts) and replace 'https:' with those explicit origins.",
  };

  function resolveDescription(alert: string, fallback: string): string {
    return CSP_DESCRIPTIONS[alert.toLowerCase()] ?? fallback;
  }

  const findings = Array.from(byAlert.values()).map(({ alert: a, urls }): RawFinding => ({
    category: mapToOWASPCategory(a.cweid, a.wascid, a.alert),
    severity: zapRiskToSeverity(a.risk),
    title: resolveTitle(a.alert, a.description),
    description: resolveDescription(a.alert, a.description),
    evidence: buildEvidence(a.evidence, urls),
  }));

  logger.info(
    {
      findingCount: findings.length,
      findings: findings.map((f) => ({
        title: f.title,
        severity: f.severity,
        category: f.category,
      })),
    },
    "ZAP scan finished — findings mapped"
  );

  return findings;
}
