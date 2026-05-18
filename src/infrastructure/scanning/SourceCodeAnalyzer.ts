import { unzipSync } from "fflate";
import type { RawFinding } from "@/domain/services/ScoringService";
import type { OWASPCategoryId } from "@/domain/value-objects/OWASPCategory";
import type { Severity } from "@/domain/value-objects/Severity";
import { createLogger } from "@/infrastructure/logger";

const logger = createLogger("SourceCodeAnalyzer");

const ALLOWED_EXTENSIONS = new Set([
  ".js", ".ts", ".jsx", ".tsx", ".mjs", ".cjs",
  ".json", ".html", ".htm", ".env.example",
]);

// Extensions to check for A04 (hardcoded secrets) in non-JS/TS projects.
// These patterns are language-agnostic (`password = "..."` works everywhere).
const FOREIGN_LANG_EXTENSIONS = new Set([
  ".java", ".kt", ".scala",
  ".cs",
  ".py",
  ".go",
  ".rb",
  ".php",
  ".rs",
]);

// Categories that cannot be evaluated from foreign-language source code.
// JS/TS-specific patterns (eval, CORS middleware, bcrypt, console.log, etc.) do not
// apply to Java, Python, Go, etc. A04 is intentionally excluded — hardcoded-secrets
// checks run cross-language. A05 is already in CODE_UNEVALUATED for all CODE scans.
const FOREIGN_LANG_UNEVALUATED: ReadonlySet<OWASPCategoryId> = new Set<OWASPCategoryId>([
  "A01_BROKEN_ACCESS_CONTROL",
  "A02_CRYPTOGRAPHIC_FAILURES",
  "A03_INJECTION",
  "A06_VULNERABLE_COMPONENTS",
  "A07_AUTH_FAILURES",
  "A08_DATA_INTEGRITY_FAILURES",
  "A09_LOGGING_FAILURES",
  "A10_SSRF",
]);

export interface SourceCodeAnalysisResult {
  findings: RawFinding[];
  unevaluated: ReadonlySet<OWASPCategoryId>;
}

// Manifest files that identify a non-JS/TS project
const LANGUAGE_MANIFESTS: Array<{ files: string[]; extensions?: string[]; language: string }> = [
  { files: ["pom.xml", "build.gradle", "build.gradle.kts"], extensions: [".java"], language: "Java" },
  { files: [], extensions: [".cs", ".csproj", ".sln"], language: ".NET (C#)" },
  { files: ["requirements.txt", "setup.py", "pyproject.toml", "Pipfile"], extensions: [".py"], language: "Python" },
  { files: ["go.mod", "go.sum"], extensions: [".go"], language: "Go" },
  { files: ["Gemfile", "Gemfile.lock"], extensions: [".rb"], language: "Ruby" },
  { files: ["composer.json"], extensions: [".php"], language: "PHP" },
  { files: ["Cargo.toml", "Cargo.lock"], extensions: [".rs"], language: "Rust" },
];

function detectForeignLanguage(paths: string[]): string | null {
  for (const { files, extensions, language } of LANGUAGE_MANIFESTS) {
    const byManifest = files.some((f) => paths.some((p) => p === f || p.endsWith(`/${f}`)));
    const byExt = extensions?.some((ext) => paths.some((p) => p.endsWith(ext))) ?? false;
    if (byManifest || byExt) return language;
  }
  return null;
}

function hasJsTsEcosystem(files: Record<string, Uint8Array>): boolean {
  const JS_TS_EXT = new Set([".js", ".ts", ".jsx", ".tsx", ".mjs", ".cjs", ".html", ".htm"]);
  const paths = Object.keys(files);
  if (paths.some((p) => {
    const dot = p.lastIndexOf(".");
    return dot !== -1 && JS_TS_EXT.has(p.slice(dot)) && !shouldSkip(p);
  })) return true;
  // package.json alone is enough to identify a Node.js project
  return paths.some((p) => (p === "package.json" || p.endsWith("/package.json")) && !p.includes("node_modules"));
}

const SKIP_DIRS = [
  "node_modules/", ".git/", "build/", "dist/",
  ".next/", ".nuxt/", ".output/", "coverage/",
  "__tests__/", "__mocks__/",
];

// Max line length heuristic: files with very long single lines are minified bundles
const MAX_LINE_LENGTH = 1000;

const MAX_FILE_BYTES = 500 * 1024;

interface SASTPattern {
  regex: RegExp;
  category: OWASPCategoryId;
  severity: Severity;
  title: string;
  description: string;
  fileFilter?: (path: string) => boolean;
}

const isNotExampleFile = (path: string) =>
  !path.endsWith(".example") && !path.includes(".env.example") && !path.includes(".sample");

const PATTERNS: SASTPattern[] = [
  // A03 Injection
  {
    // Negative lookbehind (?<![\w.]) excludes method calls like redis.eval() or obj.eval()
    regex: /(?<![\w.])eval\s*\(/g,
    category: "A03_INJECTION",
    severity: "CRITICAL",
    title: "Dangerous eval() usage",
    description: "The eval function executes arbitrary code and is a major injection risk if user-controlled data reaches it.",
  },
  {
    regex: /new\s+Function\s*\(/g,
    category: "A03_INJECTION",
    severity: "HIGH",
    title: "Dynamic Function constructor",
    description: "The Function constructor behaves like eval and can execute arbitrary code.",
  },
  {
    regex: /`[^`]*SELECT[^`]*\$\{/gi,
    category: "A03_INJECTION",
    severity: "CRITICAL",
    title: "SQL injection via template literal",
    description: "SQL query built with a template literal allows injecting arbitrary SQL through interpolated variables.",
  },
  {
    regex: /require\s*\(\s*(?:req|request|params|query|body)\b/g,
    category: "A03_INJECTION",
    severity: "CRITICAL",
    title: "Dynamic require() with user input",
    description: "Passing user-controlled data to require() enables path traversal and arbitrary module execution.",
  },
  {
    regex: /innerHTML\s*=/g,
    category: "A03_INJECTION",
    severity: "HIGH",
    title: "Direct innerHTML assignment",
    description: "Setting innerHTML with untrusted data leads to XSS. Use textContent or a sanitization library instead.",
  },
  {
    regex: /dangerouslySetInnerHTML\s*=\s*\{\s*\{\s*__html\s*:/g,
    category: "A03_INJECTION",
    severity: "MEDIUM",
    title: "dangerouslySetInnerHTML usage",
    description: "dangerouslySetInnerHTML bypasses React's XSS protection. Ensure the value is sanitized.",
  },
  {
    // Matches standalone child-process sync functions, not regex .exec() calls
    regex: /\bexecSync\s*\(|\bspawnSync\s*\(/g,
    category: "A03_INJECTION",
    severity: "HIGH",
    title: "Shell execution function detected",
    description: "execSync/spawnSync can lead to command injection if user-controlled data reaches these calls.",
  },

  // A01 Broken Access Control
  {
    // Negative lookbehind (?<![\w-]) prevents matching HTTP header names like access-control-allow-origin
    regex: /(?<![\w-])origin\s*:\s*['"\*]/g,
    category: "A01_BROKEN_ACCESS_CONTROL",
    severity: "HIGH",
    title: "CORS wildcard origin",
    description: "Allowing all origins disables the same-origin protection and exposes APIs to any website.",
  },
  {
    regex: /cors\s*\(\s*\)/g,
    category: "A01_BROKEN_ACCESS_CONTROL",
    severity: "HIGH",
    title: "CORS enabled with default (permissive) settings",
    description: "Using the cors middleware without options allows all origins. Pass an explicit allowlist of trusted origins.",
  },

  // A02 Cryptographic Failures
  {
    regex: /createHash\s*\(\s*['"]md5['"]/gi,
    category: "A02_CRYPTOGRAPHIC_FAILURES",
    severity: "HIGH",
    title: "MD5 used for hashing",
    description: "MD5 is cryptographically broken and should not be used for security-sensitive operations.",
  },
  {
    regex: /createHash\s*\(\s*['"]sha1['"]/gi,
    category: "A02_CRYPTOGRAPHIC_FAILURES",
    severity: "HIGH",
    title: "SHA-1 used for hashing",
    description: "SHA-1 is deprecated for security use. Use SHA-256 or stronger.",
  },
  {
    regex: /Math\.random\s*\(\s*\)/g,
    category: "A02_CRYPTOGRAPHIC_FAILURES",
    severity: "HIGH",
    title: "Math.random() used for security",
    description: "Math.random() is not cryptographically secure. Use crypto.randomBytes() or crypto.getRandomValues() instead.",
    fileFilter: (path) =>
      /auth|token|secret|password|session|csrf|nonce/i.test(path),
  },
  {
    regex: /algorithms?\s*:\s*\[['"]none['"]\]/gi,
    category: "A02_CRYPTOGRAPHIC_FAILURES",
    severity: "CRITICAL",
    title: "JWT 'none' algorithm allowed",
    description: "Accepting the 'none' JWT algorithm allows tokens to be forged without a valid signature.",
  },
  {
    regex: /(?:localStorage|sessionStorage)\.setItem\s*\(\s*['"][^'"]*(?:token|auth|jwt|session|credential|api.?key|password)[^'"]*['"]/gi,
    category: "A02_CRYPTOGRAPHIC_FAILURES",
    severity: "HIGH",
    title: "Sensitive token stored in web storage",
    description: "localStorage and sessionStorage are readable by any JavaScript on the page. Tokens or credentials stored here can be stolen via XSS. Use HttpOnly cookies instead.",
  },

  // A04 Insecure Design
  {
    regex: /password\s*(?:=|:)\s*['"][^'"]{8,}['"]/gi,
    category: "A04_INSECURE_DESIGN",
    severity: "CRITICAL",
    title: "Hardcoded password",
    description: "A password is hardcoded in source code. Use environment variables and a secrets manager instead.",
    fileFilter: isNotExampleFile,
  },
  {
    regex: /secret\s*(?:=|:)\s*['"][^'"]{8,}['"]/gi,
    category: "A04_INSECURE_DESIGN",
    severity: "CRITICAL",
    title: "Hardcoded secret",
    description: "A secret value is hardcoded in source code. Rotate it immediately and move it to environment variables.",
    fileFilter: isNotExampleFile,
  },
  {
    regex: /(?:api_?key|apikey|api_?secret)\s*(?:=|:)\s*['"][^'"]{8,}['"]/gi,
    category: "A04_INSECURE_DESIGN",
    severity: "HIGH",
    title: "Hardcoded API key",
    description: "An API key is hardcoded in source code. It should be stored in environment variables.",
    fileFilter: isNotExampleFile,
  },

  // A07 Auth Failures
  {
    regex: /sign\s*\(\s*[^,]+,\s*['""]\s*['"]/g,
    category: "A07_AUTH_FAILURES",
    severity: "CRITICAL",
    title: "JWT signed with empty secret",
    description: "Signing a JWT with an empty string makes it trivially forgeable.",
  },
  {
    regex: /bcrypt(?:js)?\.compare\s*\([^)]+===|bcrypt(?:js)?\.compare\s*\([^)]+==\s/g,
    category: "A07_AUTH_FAILURES",
    severity: "HIGH",
    title: "Insecure bcrypt comparison",
    description: "bcrypt.compare() returns a Promise. Comparing with === likely means comparing the Promise object, not the result.",
  },

  // A08 Data Integrity Failures
  {
    // Only flag external scripts (src starts with http/https) that lack an integrity attribute.
    // Internal scripts (relative paths like /_next/static/...) don't benefit from SRI.
    regex: /<script\s(?![^>]*\bintegrity\b)[^>]*src\s*=\s*["']https?:\/\/[^>]*>/gi,
    category: "A08_DATA_INTEGRITY_FAILURES",
    severity: "MEDIUM",
    title: "External script without Subresource Integrity (SRI)",
    description: "Loading external scripts without an integrity attribute means a compromised CDN can serve malicious code.",
    fileFilter: (path) => /\.html?$/.test(path),
  },
  {
    regex: /JSON\.parse\s*\(\s*(?:req|request|ctx|context|event)\b/g,
    category: "A08_DATA_INTEGRITY_FAILURES",
    severity: "HIGH",
    title: "Unsafe JSON.parse on request data",
    description: "Parsing request data with JSON.parse without error handling or schema validation can cause crashes and injection.",
  },

  // A09 Security Logging & Monitoring
  {
    regex: /console\.log\s*\([^)]*(?:password|passwd|secret|token|apikey|api_key|authorization)/gi,
    category: "A09_LOGGING_FAILURES",
    severity: "HIGH",
    title: "Logging sensitive data",
    description: "Sensitive data (passwords, tokens, secrets) is being logged. Remove these log statements.",
  },
  {
    regex: /catch\s*\([^)]*\)\s*\{\s*\}/g,
    category: "A09_LOGGING_FAILURES",
    severity: "MEDIUM",
    title: "Empty catch block",
    description: "Silently swallowing exceptions hides security-relevant errors and makes incidents invisible.",
  },
  {
    regex: /catch\s*\([^)]*\)\s*\{\s*\/\//g,
    category: "A09_LOGGING_FAILURES",
    severity: "LOW",
    title: "Catch block with only a comment",
    description: "A catch block that only has a comment effectively silences errors, hiding security events.",
  },

  // A10 SSRF
  {
    regex: /fetch\s*\(\s*(?:req|request|ctx)\b[^)]*(?:query|body|params)/g,
    category: "A10_SSRF",
    severity: "HIGH",
    title: "Potential SSRF — fetch with request-derived URL",
    description: "Passing user-controlled input to fetch() can enable Server-Side Request Forgery (SSRF).",
  },
  {
    regex: /axios\s*\.(?:get|post|put|delete)\s*\(\s*(?:req|request)\b/g,
    category: "A10_SSRF",
    severity: "HIGH",
    title: "Potential SSRF — axios with request-derived URL",
    description: "Passing user-controlled input to axios can enable SSRF attacks.",
  },
];

// ─── GitHub Advisory Database (GHSA) ─────────────────────────────────────────

interface GhsaVulnerability {
  package: { ecosystem: string; name: string };
  vulnerable_version_range: string | null;
  first_patched_version: string | null;
}

interface GhsaAdvisory {
  ghsa_id: string;
  cve_id: string | null;
  severity: "low" | "medium" | "high" | "critical" | null;
  summary: string;
  vulnerabilities: GhsaVulnerability[];
}

const GHSA_TTL_MS = 24 * 60 * 60 * 1000;
const _ghsaCache = new Map<string, { data: GhsaAdvisory[]; fetchedAt: number }>();

async function fetchGhsaAdvisories(packageName: string): Promise<GhsaAdvisory[]> {
  const cached = _ghsaCache.get(packageName);
  if (cached && Date.now() - cached.fetchedAt < GHSA_TTL_MS) return cached.data;
  try {
    const url = `https://api.github.com/advisories?ecosystem=npm&affects=${encodeURIComponent(packageName)}&per_page=100`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
      headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json() as GhsaAdvisory[];
    _ghsaCache.set(packageName, { data, fetchedAt: Date.now() });
    return data;
  } catch (err) {
    logger.warn({ err, packageName }, "Failed to fetch GHSA advisories — dependency checks may be incomplete");
    return _ghsaCache.get(packageName)?.data ?? [];
  }
}

function ghsaSeverityToOurs(s: string | null | undefined): Severity {
  switch (s?.toLowerCase()) {
    case "critical": return "CRITICAL";
    case "high": return "HIGH";
    case "low": return "LOW";
    default: return "MEDIUM";
  }
}

function matchesVersionRange(version: string, range: string | null): boolean {
  if (!range) return true;
  return range.split(",").map(s => s.trim()).every(condition => {
    const m = condition.match(/^([<>]=?|=)\s*(.+)$/);
    if (!m) return true;
    const [ma, mi, pa] = parseSemver(version);
    const [mb, mib, pb] = parseSemver(m[2].trim());
    const cmp = ma !== mb ? ma - mb : mi !== mib ? mi - mib : pa - pb;
    switch (m[1]) {
      case "<": return cmp < 0;
      case "<=": return cmp <= 0;
      case ">": return cmp > 0;
      case ">=": return cmp >= 0;
      case "=": return cmp === 0;
      default: return true;
    }
  });
}

function shouldSkip(path: string): boolean {
  if (SKIP_DIRS.some((d) => path.includes(d))) return true;
  const filename = path.split("/").pop() ?? "";
  return /\.(test|spec)\.[cm]?[jt]sx?$/.test(filename);
}

function hasAllowedExtension(path: string): boolean {
  if (path.endsWith(".env.example")) return true;
  const dot = path.lastIndexOf(".");
  if (dot === -1) return false;
  return ALLOWED_EXTENSIONS.has(path.slice(dot));
}

// Well-known root directories that should never be treated as a GitHub repo root prefix
const KNOWN_DIRS = new Set([
  "node_modules", ".git", ".github", "build", "dist", ".next", ".nuxt",
  "src", "lib", "public", "static", "test", "tests", "coverage", "docs",
]);

function stripRootPrefix(files: Record<string, Uint8Array>): Record<string, Uint8Array> {
  const keys = Object.keys(files);
  if (keys.length === 0) return files;

  // GitHub ZIPs have a single `repo-name-branch/` root folder wrapping all files
  const firstSlash = keys[0].indexOf("/");
  if (firstSlash === -1) return files;

  const prefixName = keys[0].slice(0, firstSlash);
  // Only strip if the prefix looks like a GitHub-generated folder name, not a source directory
  if (KNOWN_DIRS.has(prefixName) || prefixName.startsWith(".")) return files;

  const prefix = prefixName + "/";
  if (!keys.every((k) => k.startsWith(prefix))) return files;

  const stripped: Record<string, Uint8Array> = {};
  for (const [k, v] of Object.entries(files)) {
    stripped[k.slice(prefix.length)] = v;
  }
  return stripped;
}

/**
 * Removes // and /* comments from JS/TS source while keeping string literals intact.
 * Non-newline characters in comments are replaced with spaces so that byte offsets
 * (and therefore line numbers derived from them) stay correct.
 */
function stripComments(code: string): string {
  return code.replace(
    /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`|\/\/[^\n]*|\/\*[\s\S]*?\*\/)/g,
    (match) => {
      if (match.startsWith("//") || match.startsWith("/*")) {
        return match.replace(/[^\n]/g, " ");
      }
      return match;
    }
  );
}

function analyzeFile(filePath: string, content: string, patterns = PATTERNS): RawFinding[] {
  const findings: RawFinding[] = [];
  const seen = new Set<string>();
  const stripped = stripComments(content);

  for (const pattern of patterns) {
    if (pattern.fileFilter && !pattern.fileFilter(filePath)) continue;

    const matches = [...stripped.matchAll(pattern.regex)];
    if (matches.length === 0) continue;

    const key = `${pattern.category}:${pattern.title}:${filePath}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const match = matches[0];
    const lineNumber = stripped.slice(0, match.index ?? 0).split("\n").length;
    const snippet = content.split("\n")[lineNumber - 1]?.trim().slice(0, 120) ?? match[0].trim().slice(0, 120);

    findings.push({
      category: pattern.category,
      severity: pattern.severity,
      title: pattern.title,
      description: pattern.description,
      evidence: `${filePath}:${lineNumber} — ${snippet}`,
    });
  }

  return findings;
}

function parseSemver(v: string): [number, number, number] {
  const cleaned = v.replace(/^[^\d]*/, "");
  const parts = cleaned.split(".").map(Number);
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

async function analyzeDependencies(pkgContent: string): Promise<RawFinding[]> {
  let pkg: Record<string, unknown>;
  try {
    pkg = JSON.parse(pkgContent) as Record<string, unknown>;
  } catch {
    return [];
  }

  const allDeps: Record<string, string> = {
    ...((pkg.dependencies as Record<string, string>) ?? {}),
    ...((pkg.devDependencies as Record<string, string>) ?? {}),
  };

  const results = await Promise.all(
    Object.entries(allDeps).map(async ([name, rawVersion]) => {
      const version = rawVersion.replace(/^[\^~>=<\s]+/, "");
      const advisories = await fetchGhsaAdvisories(name);

      const matching = advisories.filter(advisory =>
        advisory.vulnerabilities.some(v =>
          v.package.ecosystem === "npm" &&
          v.package.name === name &&
          matchesVersionRange(version, v.vulnerable_version_range)
        )
      );
      if (matching.length === 0) return null;

      const cves = [...new Set(matching.map(a => a.cve_id).filter((c): c is string => !!c))];
      const severityRank = (s: string | null) => {
        switch (s?.toLowerCase()) { case "critical": return 4; case "high": return 3; case "medium": return 2; default: return 1; }
      };
      const worst = matching.reduce((a, b) => severityRank(a.severity) >= severityRank(b.severity) ? a : b);

      const descParts = [worst.summary, cves.length > 0 ? `CVE: ${cves.join(", ")}` : ""].filter(Boolean);
      return {
        category: "A06_VULNERABLE_COMPONENTS" as const,
        severity: ghsaSeverityToOurs(worst.severity),
        title: `Vulnerable dependency: ${name}@${rawVersion}`,
        description: descParts.join(" — ") || "Known vulnerability in this version range.",
        evidence: `package.json — "${name}": "${rawVersion}"`,
      };
    })
  );

  return results.filter((r) => r !== null) as RawFinding[];
}

export class NoValidCodeError extends Error {
  constructor() {
    super("ZIP_NO_VALID_CODE");
    this.name = "NoValidCodeError";
  }
}

const A04_PATTERNS = PATTERNS.filter((p) => p.category === "A04_INSECURE_DESIGN");

export async function runSourceCodeAnalysis(
  zipBuffer: Uint8Array
): Promise<SourceCodeAnalysisResult> {
  const rawFiles = unzipSync(zipBuffer);
  const files = stripRootPrefix(rawFiles);
  const findings: RawFinding[] = [];
  const paths = Object.keys(files);

  const foreignLanguage = detectForeignLanguage(paths);
  const jsTs = hasJsTsEcosystem(files);

  // Reject ZIPs with no recognizable source code at all (e.g. plain TXT files)
  if (!jsTs && !foreignLanguage) {
    throw new NoValidCodeError();
  }

  // Foreign-language project (Python, Java, Go, etc.) with no JS/TS:
  // run only A04 (hardcoded secrets) patterns on native source files — these regex
  // patterns are language-agnostic. All other categories are marked not_evaluated
  // because they rely on JS/TS-specific APIs and patterns.
  if (!jsTs) {
    findings.push({
      category: "A04_INSECURE_DESIGN",
      severity: "INFO",
      title: `Limited code analysis: ${foreignLanguage} project`,
      description:
        `The uploaded project appears to be written in ${foreignLanguage}. ` +
        `Only hardcoded-secrets checks (A04) are applied cross-language. ` +
        `All other code analysis categories require JavaScript/TypeScript and are marked as not evaluated.`,
      evidence: undefined,
    });

    for (const [filePath, data] of Object.entries(files)) {
      if (shouldSkip(filePath)) continue;
      const dot = filePath.lastIndexOf(".");
      if (dot === -1 || !FOREIGN_LANG_EXTENSIONS.has(filePath.slice(dot))) continue;
      if (data.length > MAX_FILE_BYTES) continue;

      const content = new TextDecoder().decode(data);
      const firstNewline = content.indexOf("\n");
      const firstLineLength = firstNewline === -1 ? content.length : firstNewline;
      if (firstLineLength > MAX_LINE_LENGTH) continue;

      findings.push(...analyzeFile(filePath, content, A04_PATTERNS));
    }

    return { findings, unevaluated: FOREIGN_LANG_UNEVALUATED };
  }

  // JS/TS project with a foreign-language component (e.g. Java backend + React frontend):
  // analyse the JS/TS side fully but note the foreign part was skipped.
  if (foreignLanguage) {
    findings.push({
      category: "A06_VULNERABLE_COMPONENTS",
      severity: "INFO",
      title: `Partial code analysis: ${foreignLanguage} components not scanned`,
      description:
        `The project contains ${foreignLanguage} source files in addition to JavaScript/TypeScript. ` +
        `Only the JS/TS portion was analyzed. ${foreignLanguage} dependencies and code patterns were not checked.`,
      evidence: undefined,
    });
  }

  // Find package.json for dependency vulnerability analysis
  const pkgPath = paths.find(
    (p) => (p === "package.json" || p.endsWith("/package.json")) && !p.includes("node_modules")
  );
  if (pkgPath) {
    const content = new TextDecoder().decode(files[pkgPath]);
    findings.push(...await analyzeDependencies(content));
  }

  // A06 is only evaluable when package.json is present (dep analysis is the sole A06 check)
  const unevaluated: Set<OWASPCategoryId> = pkgPath ? new Set() : new Set<OWASPCategoryId>(["A06_VULNERABLE_COMPONENTS"]);

  // Analyze JS/TS source files
  for (const [filePath, data] of Object.entries(files)) {
    if (shouldSkip(filePath)) continue;
    if (!hasAllowedExtension(filePath)) continue;
    if (data.length > MAX_FILE_BYTES) continue;

    const content = new TextDecoder().decode(data);

    // Skip minified files — a single line longer than MAX_LINE_LENGTH indicates a bundle
    const firstNewline = content.indexOf("\n");
    const firstLineLength = firstNewline === -1 ? content.length : firstNewline;
    if (firstLineLength > MAX_LINE_LENGTH) continue;

    findings.push(...analyzeFile(filePath, content));
  }

  return { findings, unevaluated };
}
