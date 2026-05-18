import type { RawFinding } from "@/domain/services/ScoringService";
import type { OWASPCategoryId } from "@/domain/value-objects/OWASPCategory";
import type { Severity } from "@/domain/value-objects/Severity";
import { createLogger } from "@/infrastructure/logger";

const logger = createLogger("ZapClient");

const ZAP_URL = process.env.ZAP_URL ?? "http://localhost:8050";
const ZAP_API_KEY = process.env.ZAP_API_KEY ?? "changeme";

// ─── Retire.js CVE enrichment ─────────────────────────────────────────────────
// ZAP's retire.js alerts don't include CVE IDs in any alert field — only a
// generic OWASP reference URL. We fetch the retire.js database once per process
// and look up CVEs by library name + version ourselves.

interface RetireJsVuln {
  atOrAbove?: string;
  below?: string;
  identifiers?: { CVE?: string[] };
}

const RETIRE_DB_TTL_MS = 24 * 60 * 60 * 1000;
let _retireJsDb: Record<string, { vulnerabilities: RetireJsVuln[] }> | null = null;
let _retireJsDbFetchedAt = 0;

async function getRetireJsDb(): Promise<Record<string, { vulnerabilities: RetireJsVuln[] }>> {
  if (_retireJsDb && Date.now() - _retireJsDbFetchedAt < RETIRE_DB_TTL_MS) return _retireJsDb;
  try {
    const res = await fetch(
      "https://raw.githubusercontent.com/RetireJS/retire.js/master/repository/jsrepository.json",
      { signal: AbortSignal.timeout(10_000) }
    );
    _retireJsDb = await res.json() as Record<string, { vulnerabilities: RetireJsVuln[] }>;
    _retireJsDbFetchedAt = Date.now();
    logger.info("retire.js CVE database loaded");
  } catch (err) {
    logger.warn({ err }, "Failed to fetch retire.js CVE database — CVE enrichment skipped");
    if (!_retireJsDb) _retireJsDb = {};
  }
  return _retireJsDb;
}

// Maps our display names (from URL_LIBRARY_HINTS) to retire.js database keys.
const RETIRE_KEY_MAP: Record<string, string> = {
  "next.js": "nextjs",
  "react-dom": "react-dom",
  "react": "react",
  "jquery": "jquery",
  "bootstrap": "bootstrap",
  "angular": "angularjs",
  "vue": "vue",
  "lodash": "lodash",
  "moment.js": "moment",
};

function semverCompare(a: string, b: string): number {
  const parse = (v: string) => {
    const [main = "", pre = ""] = v.split("-");
    const parts = main.split(".").map((n) => parseInt(n, 10) || 0);
    return { parts, pre };
  };
  const va = parse(a);
  const vb = parse(b);
  for (let i = 0; i < Math.max(va.parts.length, vb.parts.length); i++) {
    const diff = (va.parts[i] ?? 0) - (vb.parts[i] ?? 0);
    if (diff !== 0) return diff;
  }
  // Same numeric parts: pre-release < release
  if (va.pre && !vb.pre) return -1;
  if (!va.pre && vb.pre) return 1;
  return 0;
}

function lookupCves(
  db: Record<string, { vulnerabilities: RetireJsVuln[] }>,
  library: string,
  version: string
): string[] {
  const key = RETIRE_KEY_MAP[library.toLowerCase()] ?? library.toLowerCase().replace(/\./g, "");
  const vulns = db[key]?.vulnerabilities ?? [];
  const cves: string[] = [];
  for (const v of vulns) {
    const aboveOk = !v.atOrAbove || semverCompare(version, v.atOrAbove) >= 0;
    const belowOk = !v.below || semverCompare(version, v.below) < 0;
    if (aboveOk && belowOk && v.identifiers?.CVE) cves.push(...v.identifiers.CVE);
  }
  return [...new Set(cves)];
}

interface ZapAlert {
  alert: string;
  description: string;
  risk: string; // Informational | Low | Medium | High
  solution: string;
  reference: string;
  otherinfo: string;
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
  if ([1104].includes(cwe) || alert.includes("vulnerable js library") || alert.includes("vulnerable component")) return "A06_VULNERABLE_COMPONENTS";

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

// retire.js is the addon responsible for vulnerable-library detection.
// installAddon fetches the latest version directly from the ZAP marketplace
// without requiring a prior update check (unlike updateAllAddons).
export async function updateZapAddons(): Promise<void> {
  logger.info("Updating ZAP retire.js addon");
  const res = await zapGet<{ Result: string }>("autoupdate/action/installAddon", { id: "retire" });
  logger.info({ result: res.Result }, "ZAP retire.js addon update complete");
}

export async function runZapActiveScan(targetUrl: string): Promise<RawFinding[]> {
  const zapTargetUrl = resolveZapTargetUrl(targetUrl);
  logger.info({ targetUrl, zapTargetUrl }, "ZAP scan starting");

  // 1. Spider the target
  const spiderRes = await zapGet<{ scan: string }>("spider/action/scan", {
    url: zapTargetUrl,
    maxChildren: "50",
    maxDuration: "4", // minutes; prevents runaway crawls
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

  // 4. Wait for passive scan queue to drain before collecting alerts.
  // Passive rules (e.g. retire.js) run asynchronously on a separate queue and may still be
  // processing responses when the active scan reports 100% — collecting alerts too early
  // causes non-deterministic misses.
  await pollUntilComplete(
    async () => {
      const pscan = await zapGet<{ recordsToScan: string }>("pscan/view/recordsToScan");
      const remaining = parseInt(pscan.recordsToScan, 10);
      logger.info({ remaining }, "Passive scan queue");
      return remaining === 0 ? 100 : 0;
    },
    120_000,
    2000
  );
  logger.info("Passive scan queue drained");

  // 5. Get alerts
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

  // CDNs that serve dynamically-versioned or browser-negotiated content —
  // SRI hashes can't be pre-computed for these and are not published by the vendor.
  const DYNAMIC_CDN_HOSTS = [
    "googlesyndication.com",
    "googletagmanager.com",
    "google-analytics.com",
    "googletagservices.com",
    "doubleclick.net",
    "connect.facebook.net",
    "static.hotjar.com",
    // Google Fonts serves browser-negotiated CSS (woff2 vs woff varies per UA) —
    // SRI is technically impossible without self-hosting the fonts.
    "fonts.googleapis.com",
    "fonts.gstatic.com",
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

  // URL path fragments → library name (Retire.js bundles Next.js, React, etc. into generic chunks).
  const URL_LIBRARY_HINTS: Array<[RegExp, string]> = [
    [/\/_next\//, "next.js"],
    [/jquery[.\-_]/i, "jQuery"],
    [/bootstrap[.\-_]/i, "Bootstrap"],
    [/react-dom[.\-_]/i, "react-dom"],
    [/react[.\-_]/i, "React"],
    [/angular[.\-_]/i, "Angular"],
    [/vue[.\-_]/i, "Vue"],
    [/lodash[.\-_]/i, "lodash"],
    [/moment[.\-_]/i, "moment.js"],
  ];

  function inferLibraryFromUrl(url: string): string | undefined {
    for (const [pattern, name] of URL_LIBRARY_HINTS) {
      if (pattern.test(url)) return name;
    }
    return undefined;
  }

  // Retire.js description is often just "The identified library appears to be vulnerable." — no name.
  // Extract version from evidence snippet and infer library from the JS file URL.
  function parseLibraryInfo(
    description: string,
    evidence: string,
    url: string
  ): { library: string; version: string } | null {
    // Some ZAP versions do include the name: "...library <name> - <version> appears..."
    const descMatch = description.match(/identified library\s+(.+?)\s+-\s+([\d.]+)\s+appears/i);
    if (descMatch) return { library: descMatch[1].trim(), version: descMatch[2] };

    const version = evidence?.match(/[=\s"'](\d+\.\d+\.\d+(?:\.\d+)?)[;,"'\s]/)?.[1];
    const library = inferLibraryFromUrl(url);
    if (library && version) return { library, version };
    if (version) return { library: "Unknown library", version };
    return null;
  }

  const retireDb = await getRetireJsDb();

  function isFalsePositive(a: ZapAlert): boolean {
    const alert = a.alert.toLowerCase();

    // Spider/crawler metadata — not a security finding.
    if (alert.includes("modern web application")) return true;

    // Cross-Domain JavaScript: only a problem when the script host is unknown/untrusted.
    // Same-domain scripts and known ad/analytics CDNs are intentional inclusions.
    if (alert.includes("cross-domain javascript")) {
      const url = extractResourceUrl(a.evidence);
      return isSameDomainUrl(url) || isDynamicCdnUrl(url);
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
      if (a.risk.toLowerCase() === "informational" || a.risk.toLowerCase() === "low") return true;
    }

    // Cache-Control: public, max-age=0 is correct for dynamic HTML (forces revalidation, allows CDN).
    // ZAP's "Re-examine Cache-control Directives" fires on this but it is not a misconfiguration.
    if (alert.includes("cache-control") || alert.includes("re-examine cache")) return true;

    // ZAP's retire.js addon ships its own bundled database that can lag behind the canonical
    // GitHub repository. If ZAP flags a "Vulnerable JS Library" but the current retire.js DB
    // reports no CVEs for that library+version, the addon is using stale data — treat as false positive.
    if (alert.includes("vulnerable js library")) {
      const libInfo = parseLibraryInfo(a.description, a.evidence ?? "", a.url ?? "");
      if (libInfo && lookupCves(retireDb, libInfo.library, libInfo.version).length === 0) return true;
    }

    return false;
  }

  // Deduplicate by resolved title (not raw alert name) so each distinct vulnerable library gets its own entry.
  // Keep the worst severity and collect up to 3 example URLs as evidence.
  const byAlert = new Map<string, { alert: ZapAlert; urls: string[] }>();
  for (const a of alerts) {
    // ZAP uses cweid "0" (not empty string) when no real CWE applies — treat it as absent.
    const hasCwe = a.cweid && a.cweid !== "0";
    if (a.risk.toLowerCase() === "informational" && !hasCwe) continue;
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

  function resolveTitle(alert: string): string {
    if (!alert.toLowerCase().includes("vulnerable js library")) return alert;
    return "Vulnerable JS Library";
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

  function resolveDescription(alert: string, fallback: string, cves: string[]): string {
    const base = CSP_DESCRIPTIONS[alert.toLowerCase()] ?? fallback;
    if (cves.length === 0) return base;
    return `${base}\n\nCVE: ${cves.join(", ")}`;
  }

  const findings = Array.from(byAlert.values()).map(({ alert: a, urls }): RawFinding => {
    const isVulnerableLib = a.alert.toLowerCase().includes("vulnerable js library");
    const libInfo = isVulnerableLib
      ? parseLibraryInfo(a.description, a.evidence ?? "", a.url ?? "")
      : null;

    const cves = libInfo ? lookupCves(retireDb, libInfo.library, libInfo.version) : [];

    const evidence = libInfo
      ? `Library: ${libInfo.library}\nVersion: ${libInfo.version}`
      : buildEvidence(a.evidence, urls);

    return {
      category: mapToOWASPCategory(a.cweid, a.wascid, a.alert),
      severity: zapRiskToSeverity(a.risk),
      title: resolveTitle(a.alert),
      description: resolveDescription(a.alert, a.description, cves),
      evidence,
    };
  });

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
