import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { zipSync, strToU8 } from "fflate";
import { runSourceCodeAnalysis, NoValidCodeError } from "../SourceCodeAnalyzer";

const FAKE_GHSA_DB: Record<string, object[]> = {
  jsonwebtoken: [{ ghsa_id: "GHSA-fake-1", cve_id: "CVE-2022-23529", severity: "high", summary: "Algorithm confusion attacks (CVE-2022-23529)", vulnerabilities: [{ package: { ecosystem: "npm", name: "jsonwebtoken" }, vulnerable_version_range: "< 9.0.0", first_patched_version: "9.0.0" }] }],
  lodash:       [{ ghsa_id: "GHSA-fake-2", cve_id: "CVE-2021-23337", severity: "medium", summary: "Prototype pollution (CVE-2021-23337)", vulnerabilities: [{ package: { ecosystem: "npm", name: "lodash" }, vulnerable_version_range: "< 4.17.21", first_patched_version: "4.17.21" }] }],
  axios:        [{ ghsa_id: "GHSA-fake-3", cve_id: null, severity: "high", summary: "SSRF and CSRF vulnerabilities", vulnerabilities: [{ package: { ecosystem: "npm", name: "axios" }, vulnerable_version_range: "< 1.6.0", first_patched_version: "1.6.0" }] }],
  express:      [{ ghsa_id: "GHSA-fake-4", cve_id: null, severity: "medium", summary: "ReDoS and open redirect", vulnerabilities: [{ package: { ecosystem: "npm", name: "express" }, vulnerable_version_range: "< 4.18.0", first_patched_version: "4.18.0" }] }],
  "node-fetch": [{ ghsa_id: "GHSA-fake-5", cve_id: "CVE-2022-0235", severity: "high", summary: "SSRF (CVE-2022-0235)", vulnerabilities: [{ package: { ecosystem: "npm", name: "node-fetch" }, vulnerable_version_range: "< 2.6.7", first_patched_version: "2.6.7" }] }],
};

beforeAll(() => {
  vi.stubGlobal("fetch", vi.fn((url: string) => {
    const match = decodeURIComponent(url).match(/affects=([^&]+)/);
    const data = match ? (FAKE_GHSA_DB[match[1]] ?? []) : [];
    return Promise.resolve({ ok: true, json: () => Promise.resolve(data) } as Response);
  }));
});

afterAll(() => {
  vi.unstubAllGlobals();
});

function makeZip(files: Record<string, string>): Uint8Array {
  const input: Record<string, Uint8Array> = {};
  for (const [k, v] of Object.entries(files)) {
    input[k] = strToU8(v);
  }
  return zipSync(input);
}

function makeGitHubZip(files: Record<string, string>): Uint8Array {
  const prefixed: Record<string, string> = {};
  for (const [k, v] of Object.entries(files)) {
    prefixed[`my-repo-main/${k}`] = v;
  }
  return makeZip(prefixed);
}

describe("runSourceCodeAnalysis", () => {
  it("returns empty findings for safe code", async () => {
    const zip = makeZip({ "index.ts": "export const greeting = 'hello world';" });
    const { findings } = await runSourceCodeAnalysis(zip);
    expect(findings).toHaveLength(0);
  });

  it("detects eval() → A05_INJECTION CRITICAL", async () => {
    const zip = makeZip({ "utils.js": "function run(code) { eval(code); }" });
    const { findings } = await runSourceCodeAnalysis(zip);
    const f = findings.find((f) => f.title.includes("eval"));
    expect(f).toBeDefined();
    expect(f?.category).toBe("A05_INJECTION");
    expect(f?.severity).toBe("CRITICAL");
  });

  it("detects SQL injection via template literal → A05_INJECTION CRITICAL", async () => {
    const zip = makeZip({
      "db.ts": "const q = `SELECT * FROM users WHERE id = ${userId}`;",
    });
    const { findings } = await runSourceCodeAnalysis(zip);
    const f = findings.find((f) => f.title.includes("SQL injection"));
    expect(f).toBeDefined();
    expect(f?.category).toBe("A05_INJECTION");
    expect(f?.severity).toBe("CRITICAL");
  });

  it("detects CORS wildcard → A01_BROKEN_ACCESS_CONTROL HIGH", async () => {
    const zip = makeZip({
      "server.js": "app.use(cors({ origin: '*' }));",
    });
    const { findings } = await runSourceCodeAnalysis(zip);
    const f = findings.find((f) => f.title.includes("CORS"));
    expect(f).toBeDefined();
    expect(f?.category).toBe("A01_BROKEN_ACCESS_CONTROL");
  });

  it("detects MD5 hashing → A04_CRYPTOGRAPHIC_FAILURES HIGH", async () => {
    const zip = makeZip({
      "hash.js": "const h = crypto.createHash('md5').update(data).digest('hex');",
    });
    const { findings } = await runSourceCodeAnalysis(zip);
    const f = findings.find((f) => f.title.includes("MD5"));
    expect(f).toBeDefined();
    expect(f?.category).toBe("A04_CRYPTOGRAPHIC_FAILURES");
    expect(f?.severity).toBe("HIGH");
  });

  it("detects hardcoded password → A06_INSECURE_DESIGN CRITICAL", async () => {
    const zip = makeZip({
      "config.ts": "const password = 'super-secret-password-123';",
    });
    const { findings } = await runSourceCodeAnalysis(zip);
    const f = findings.find((f) => f.title.includes("Hardcoded password"));
    expect(f).toBeDefined();
    expect(f?.category).toBe("A06_INSECURE_DESIGN");
    expect(f?.severity).toBe("CRITICAL");
  });

  it("does not flag hardcoded values in .env.example files", async () => {
    const zip = makeZip({
      "index.js": "export const x = 1;",
      ".env.example": "password=your-password-here",
    });
    const { findings } = await runSourceCodeAnalysis(zip);
    const f = findings.find((f) => f.title.includes("Hardcoded password"));
    expect(f).toBeUndefined();
  });

  it("detects logging sensitive data → A09_LOGGING_FAILURES HIGH", async () => {
    const zip = makeZip({
      "auth.ts": "console.log('user password:', password);",
    });
    const { findings } = await runSourceCodeAnalysis(zip);
    const f = findings.find((f) => f.title.includes("Logging sensitive"));
    expect(f).toBeDefined();
    expect(f?.category).toBe("A09_LOGGING_FAILURES");
    expect(f?.severity).toBe("HIGH");
  });

  it("detects empty catch block → A10_EXCEPTIONAL_CONDITIONS MEDIUM", async () => {
    const zip = makeZip({
      "handler.ts": "try { doSomething(); } catch (err) {}",
    });
    const { findings } = await runSourceCodeAnalysis(zip);
    const f = findings.find((f) => f.title.includes("Empty catch"));
    expect(f).toBeDefined();
    expect(f?.category).toBe("A10_EXCEPTIONAL_CONDITIONS");
    expect(f?.severity).toBe("MEDIUM");
  });

  it("detects missing SRI on external script in HTML → A08_DATA_INTEGRITY_FAILURES", async () => {
    const zip = makeZip({
      "index.html": '<html><script src="https://cdn.example.com/lib.js"></script></html>',
    });
    const { findings } = await runSourceCodeAnalysis(zip);
    const f = findings.find((f) => f.title.includes("Subresource Integrity"));
    expect(f).toBeDefined();
    expect(f?.category).toBe("A08_DATA_INTEGRITY_FAILURES");
  });

  it("does not flag internal (same-origin) scripts for missing SRI", async () => {
    const zip = makeZip({
      "index.html": '<html><script src="/_next/static/chunks/main.js"></script></html>',
    });
    const { findings } = await runSourceCodeAnalysis(zip);
    const f = findings.find((f) => f.title.includes("Subresource Integrity"));
    expect(f).toBeUndefined();
  });

  it("does not flag external script that already has integrity attribute", async () => {
    const zip = makeZip({
      "index.html":
        '<html><script src="https://cdn.example.com/lib.js" integrity="sha384-abc123" crossorigin="anonymous"></script></html>',
    });
    const { findings } = await runSourceCodeAnalysis(zip);
    const f = findings.find((f) => f.title.includes("Subresource Integrity"));
    expect(f).toBeUndefined();
  });

  it("skips files in node_modules/", async () => {
    const zip = makeZip({
      "index.js": "export const x = 1;",
      "node_modules/some-lib/index.js": "eval('bad code');",
    });
    const { findings } = await runSourceCodeAnalysis(zip);
    expect(findings).toHaveLength(0);
  });

  it("skips files in .git/", async () => {
    const zip = makeZip({
      "index.js": "export const x = 1;",
      ".git/config": "password=secret-in-git-config",
    });
    const { findings } = await runSourceCodeAnalysis(zip);
    expect(findings).toHaveLength(0);
  });

  it("skips files in .next/", async () => {
    const zip = makeZip({
      "index.js": "export const x = 1;",
      ".next/server/chunks/app.js": "eval('client code');",
    });
    const { findings } = await runSourceCodeAnalysis(zip);
    expect(findings).toHaveLength(0);
  });

  it("handles GitHub ZIP format with root folder prefix", async () => {
    const zip = makeGitHubZip({
      "app.ts": "const password = 'hardcoded-secret-123';",
    });
    const { findings } = await runSourceCodeAnalysis(zip);
    expect(findings.some((f) => f.title.includes("Hardcoded password"))).toBe(true);
  });

  it("detects localStorage.setItem with token key → A04_CRYPTOGRAPHIC_FAILURES HIGH", async () => {
    const zip = makeZip({
      "auth.ts": "localStorage.setItem('access_token', response.token);",
    });
    const { findings } = await runSourceCodeAnalysis(zip);
    const f = findings.find((f) => f.title.includes("web storage"));
    expect(f).toBeDefined();
    expect(f?.category).toBe("A04_CRYPTOGRAPHIC_FAILURES");
    expect(f?.severity).toBe("HIGH");
  });

  it("detects sessionStorage.setItem with jwt key → A04_CRYPTOGRAPHIC_FAILURES HIGH", async () => {
    const zip = makeZip({
      "session.ts": "sessionStorage.setItem('jwt', token);",
    });
    const { findings } = await runSourceCodeAnalysis(zip);
    const f = findings.find((f) => f.title.includes("web storage"));
    expect(f).toBeDefined();
    expect(f?.category).toBe("A04_CRYPTOGRAPHIC_FAILURES");
  });

  it("does not flag localStorage.setItem with non-sensitive key", async () => {
    const zip = makeZip({
      "ui.ts": "localStorage.setItem('theme', 'dark');",
    });
    const { findings } = await runSourceCodeAnalysis(zip);
    const f = findings.find((f) => f.title.includes("web storage"));
    expect(f).toBeUndefined();
  });

  it("detects vulnerable dependency → A03_SUPPLY_CHAIN_FAILURES", async () => {
    const lockfile = { lockfileVersion: 2, packages: { "": {}, "node_modules/jsonwebtoken": { version: "8.5.0" } } };
    const zip = makeZip({
      "package.json": JSON.stringify({ dependencies: { jsonwebtoken: "^8.5.0" } }),
      "package-lock.json": JSON.stringify(lockfile),
    });
    const { findings } = await runSourceCodeAnalysis(zip);
    const f = findings.find((f) => f.title.includes("jsonwebtoken"));
    expect(f).toBeDefined();
    expect(f?.category).toBe("A03_SUPPLY_CHAIN_FAILURES");
  });

  it("does not flag up-to-date dependencies", async () => {
    const lockfile = { lockfileVersion: 2, packages: { "": {}, "node_modules/jsonwebtoken": { version: "9.0.2" } } };
    const zip = makeZip({
      "package.json": JSON.stringify({ dependencies: { jsonwebtoken: "^9.0.2" } }),
      "package-lock.json": JSON.stringify(lockfile),
    });
    const { findings } = await runSourceCodeAnalysis(zip);
    const f = findings.find((f) => f.title.includes("jsonwebtoken"));
    expect(f).toBeUndefined();
  });

  // ─── False-positive regression tests ────────────────────────────────────────
  // eval() / new Function() inside string literals (e.g. SAST titles, descriptions)
  it("does not flag eval() inside a string literal", async () => {
    const zip = makeZip({
      "analyzer.ts": 'const title = "Dangerous eval() usage"; export default title;',
    });
    const { findings } = await runSourceCodeAnalysis(zip);
    expect(findings.find((f) => f.title.includes("eval"))).toBeUndefined();
  });

  it("does not flag new Function() inside a string literal", async () => {
    const zip = makeZip({
      "docs.ts":
        'const desc = "eval(), new Function(), and setTimeout(string) are dangerous.";',
    });
    const { findings } = await runSourceCodeAnalysis(zip);
    expect(findings.find((f) => f.title.includes("Function constructor"))).toBeUndefined();
  });

  it("still flags real eval() calls when a descriptive string is also present", async () => {
    const zip = makeZip({
      "run.ts":
        'const info = "This calls eval() below";\nfunction execute(code: string) { eval(code); }',
    });
    const { findings } = await runSourceCodeAnalysis(zip);
    expect(findings.find((f) => f.title.includes("eval"))).toBeDefined();
  });

  it("still flags real new Function() calls when a descriptive string is also present", async () => {
    const zip = makeZip({
      "dsl.ts":
        'const note = "new Function() is like eval";\nconst fn = new Function("x", "return x");',
    });
    const { findings } = await runSourceCodeAnalysis(zip);
    expect(findings.find((f) => f.title.includes("Function constructor"))).toBeDefined();
  });

  // CORS: window.location.origin in a ternary must NOT be flagged
  it("does not flag window.location.origin used as a URL base (ternary)", async () => {
    const zip = makeZip({
      "badge.ts":
        'const origin = typeof window !== "undefined" ? window.location.origin : "https://example.com";\n' +
        "const url = `${origin}/api/badge/123`;",
    });
    const { findings } = await runSourceCodeAnalysis(zip);
    expect(findings.find((f) => f.title.includes("CORS"))).toBeUndefined();
  });

  it("still flags cors({ origin: '*' }) after the lookbehind fix", async () => {
    const zip = makeZip({
      "server.ts": "app.use(cors({ origin: '*' }));",
    });
    const { findings } = await runSourceCodeAnalysis(zip);
    expect(findings.find((f) => f.title.includes("CORS wildcard"))).toBeDefined();
  });

  // dangerouslySetInnerHTML with JSON.stringify (JSON-LD) must NOT be flagged
  it("does not flag dangerouslySetInnerHTML when value is JSON.stringify (JSON-LD pattern)", async () => {
    const zip = makeZip({
      "page.tsx":
        'const jsonLd = { "@type": "WebSite" };\n' +
        'export default function Page() {\n' +
        '  return <script type="application/ld+json"\n' +
        '    dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\\\u003c") }}\n' +
        "  />;\n" +
        "}",
    });
    const { findings } = await runSourceCodeAnalysis(zip);
    expect(findings.find((f) => f.title.includes("dangerouslySetInnerHTML"))).toBeUndefined();
  });

  it("still flags dangerouslySetInnerHTML with user-controlled input", async () => {
    const zip = makeZip({
      "post.tsx":
        "export default function Post({ html }: { html: string }) {\n" +
        "  return <div dangerouslySetInnerHTML={{ __html: html }} />;\n" +
        "}",
    });
    const { findings } = await runSourceCodeAnalysis(zip);
    expect(findings.find((f) => f.title.includes("dangerouslySetInnerHTML"))).toBeDefined();
  });

  // Legacy comment-based tests (kept for coverage)
  it("does not flag eval() in a single-line comment", async () => {
    const zip = makeZip({
      "next.config.js":
        "// react-refresh (hot reload) uses eval(); NOT included in production\nmodule.exports = {};",
    });
    const { findings } = await runSourceCodeAnalysis(zip);
    expect(findings.find((f) => f.title.includes("eval"))).toBeUndefined();
  });

  it("does not flag eval() in a block comment", async () => {
    const zip = makeZip({
      "config.js": "/* This lib uses eval() internally */\nmodule.exports = {};",
    });
    const { findings } = await runSourceCodeAnalysis(zip);
    expect(findings.find((f) => f.title.includes("eval"))).toBeUndefined();
  });

  it("does not flag new Function() in a comment", async () => {
    const zip = makeZip({
      "util.js": "// new Function() is like eval — avoid it\nexport const noop = () => {};",
    });
    const { findings } = await runSourceCodeAnalysis(zip);
    expect(findings.find((f) => f.title.includes("Function constructor"))).toBeUndefined();
  });

  it("still flags real eval() calls after comment stripping", async () => {
    const zip = makeZip({
      "run.js":
        "// safe comment mentioning eval()\nfunction execute(code) { eval(code); }",
    });
    const { findings } = await runSourceCodeAnalysis(zip);
    const f = findings.find((f) => f.title.includes("eval"));
    expect(f).toBeDefined();
    expect(f?.severity).toBe("CRITICAL");
  });

  describe("unevaluated categories", () => {
    it("marks A06 as not_evaluated when no package.json is present", async () => {
      const zip = makeZip({ "index.ts": "export const x = 1;" });
      const { unevaluated } = await runSourceCodeAnalysis(zip);
      expect(unevaluated.has("A03_SUPPLY_CHAIN_FAILURES")).toBe(true);
    });

    it("does not mark A06 as not_evaluated when package.json and package-lock.json are present", async () => {
      const lockfile = { lockfileVersion: 2, packages: { "": {} } };
      const zip = makeZip({
        "index.ts": "export const x = 1;",
        "package.json": JSON.stringify({ dependencies: {} }),
        "package-lock.json": JSON.stringify(lockfile),
      });
      const { unevaluated } = await runSourceCodeAnalysis(zip);
      expect(unevaluated.has("A03_SUPPLY_CHAIN_FAILURES")).toBe(false);
    });

    it("marks A06 as not_evaluated when package.json is present but package-lock.json is missing", async () => {
      const zip = makeZip({
        "index.ts": "export const x = 1;",
        "package.json": JSON.stringify({ dependencies: {} }),
      });
      const { unevaluated } = await runSourceCodeAnalysis(zip);
      expect(unevaluated.has("A03_SUPPLY_CHAIN_FAILURES")).toBe(true);
    });

    it("returns empty unevaluated set for a full JS/TS project with package.json and lock file", async () => {
      const lockfile = { lockfileVersion: 2, packages: { "": {} } };
      const zip = makeZip({
        "index.ts": "export const x = 1;",
        "package.json": JSON.stringify({ dependencies: {} }),
        "package-lock.json": JSON.stringify(lockfile),
      });
      const { unevaluated } = await runSourceCodeAnalysis(zip);
      expect(unevaluated.size).toBe(0);
    });
  });

  describe("foreign language detection", () => {
    it("returns INFO finding for a pure Java project and marks JS-specific categories as not_evaluated", async () => {
      const zip = makeZip({
        "pom.xml": "<project><groupId>com.example</groupId></project>",
        "src/main/java/App.java": "public class App {}",
      });
      const { findings, unevaluated } = await runSourceCodeAnalysis(zip);
      const info = findings.find((f) => f.severity === "INFO");
      expect(info).toBeDefined();
      expect(info?.title).toContain("Java");
      expect(info?.category).toBe("A06_INSECURE_DESIGN");
      expect(unevaluated.has("A05_INJECTION")).toBe(true);
      expect(unevaluated.has("A03_SUPPLY_CHAIN_FAILURES")).toBe(true);
      expect(unevaluated.has("A09_LOGGING_FAILURES")).toBe(true);
    });

    it("does not mark A04 as not_evaluated for a foreign language project", async () => {
      const zip = makeZip({ "app.py": "from flask import Flask" });
      const { unevaluated } = await runSourceCodeAnalysis(zip);
      expect(unevaluated.has("A06_INSECURE_DESIGN")).toBe(false);
    });

    it("detects hardcoded password in a Python file", async () => {
      const zip = makeZip({
        "app.py": "db_password = 'super-secret-password-123'",
      });
      const { findings } = await runSourceCodeAnalysis(zip);
      const f = findings.find((f) => f.title.includes("Hardcoded password"));
      expect(f).toBeDefined();
      expect(f?.category).toBe("A06_INSECURE_DESIGN");
      expect(f?.severity).toBe("CRITICAL");
    });

    it("detects hardcoded secret in a Java file", async () => {
      const zip = makeZip({
        "Config.java": 'private static final String secret = "my-jwt-secret-key";',
      });
      const { findings } = await runSourceCodeAnalysis(zip);
      const f = findings.find((f) => f.title.includes("Hardcoded secret"));
      expect(f).toBeDefined();
      expect(f?.category).toBe("A06_INSECURE_DESIGN");
    });

    it("detects hardcoded API key in a Go file", async () => {
      const zip = makeZip({
        "main.go": 'var api_key = "sk-prod-abcdefghijklmnop"',
      });
      const { findings } = await runSourceCodeAnalysis(zip);
      const f = findings.find((f) => f.title.includes("API key"));
      expect(f).toBeDefined();
      expect(f?.category).toBe("A06_INSECURE_DESIGN");
    });

    it("returns INFO finding for a .NET project (.csproj)", async () => {
      const zip = makeZip({
        "MyApp.csproj": "<Project Sdk=\"Microsoft.NET.Sdk\"></Project>",
        "Program.cs": "Console.WriteLine(\"Hello\");",
      });
      const { findings } = await runSourceCodeAnalysis(zip);
      const info = findings.find((f) => f.severity === "INFO");
      expect(info).toBeDefined();
      expect(info?.title).toContain(".NET");
    });

    it("returns INFO finding for a Python project (requirements.txt)", async () => {
      const zip = makeZip({
        "requirements.txt": "flask==2.3.0\nrequests==2.28.0",
        "app.py": "from flask import Flask",
      });
      const { findings } = await runSourceCodeAnalysis(zip);
      const info = findings.find((f) => f.severity === "INFO");
      expect(info).toBeDefined();
      expect(info?.title).toContain("Python");
    });

    it("returns partial analysis finding for mixed Java + React project", async () => {
      const zip = makeZip({
        "pom.xml": "<project/>",
        "frontend/src/App.tsx": "export default function App() { return <div/>; }",
      });
      const { findings } = await runSourceCodeAnalysis(zip);
      const warning = findings.find((f) => f.title.includes("Partial code analysis"));
      expect(warning).toBeDefined();
      expect(warning?.severity).toBe("INFO");
    });

    it("throws NoValidCodeError for a ZIP with only non-code files", async () => {
      const zip = makeZip({ "readme.txt": "hello", "notes.txt": "" });
      await expect(runSourceCodeAnalysis(zip)).rejects.toThrow(NoValidCodeError);
    });

    it("throws NoValidCodeError for an empty ZIP", async () => {
      const zip = makeZip({});
      await expect(runSourceCodeAnalysis(zip)).rejects.toThrow(NoValidCodeError);
    });

    it("runs full JS/TS analysis on pure JS project without any language warning", async () => {
      const lockfile = { lockfileVersion: 2, packages: { "": {} } };
      const zip = makeZip({
        "index.ts": "eval('bad');",
        "package.json": JSON.stringify({ dependencies: {} }),
        "package-lock.json": JSON.stringify(lockfile),
      });
      const { findings } = await runSourceCodeAnalysis(zip);
      const langWarning = findings.find((f) => f.severity === "INFO" && f.title.includes("analysis"));
      expect(langWarning).toBeUndefined();
      expect(findings.some((f) => f.title.includes("eval"))).toBe(true);
    });
  });

  describe("package-lock.json version resolution", () => {
    it("uses exact locked version and does not flag when locked version is patched (v2 lockfile)", async () => {
      const lockfile = {
        lockfileVersion: 2,
        packages: { "": {}, "node_modules/express": { version: "4.19.0" } },
      };
      const zip = makeZip({
        "package.json": JSON.stringify({ dependencies: { express: "^4.17.0" } }),
        "package-lock.json": JSON.stringify(lockfile),
      });
      const { findings } = await runSourceCodeAnalysis(zip);
      expect(findings.find((f) => f.title.includes("express"))).toBeUndefined();
    });

    it("flags vulnerable exact version from v2 lockfile", async () => {
      const lockfile = {
        lockfileVersion: 2,
        packages: { "": {}, "node_modules/express": { version: "4.17.0" } },
      };
      const zip = makeZip({
        "package.json": JSON.stringify({ dependencies: { express: "^4.17.0" } }),
        "package-lock.json": JSON.stringify(lockfile),
      });
      const { findings } = await runSourceCodeAnalysis(zip);
      const f = findings.find((f) => f.title.includes("express"));
      expect(f).toBeDefined();
      expect(f?.evidence).toContain("package-lock.json");
    });

    it("uses exact locked version from v1 lockfile", async () => {
      const lockfile = {
        lockfileVersion: 1,
        dependencies: { express: { version: "4.19.0" } },
      };
      const zip = makeZip({
        "package.json": JSON.stringify({ dependencies: { express: "^4.17.0" } }),
        "package-lock.json": JSON.stringify(lockfile),
      });
      const { findings } = await runSourceCodeAnalysis(zip);
      expect(findings.find((f) => f.title.includes("express"))).toBeUndefined();
    });

    it("marks A06 as not_evaluated and emits INFO finding when package-lock.json is absent", async () => {
      const zip = makeZip({
        "package.json": JSON.stringify({ dependencies: { express: "^4.17.0" } }),
      });
      const { findings, unevaluated } = await runSourceCodeAnalysis(zip);
      expect(unevaluated.has("A03_SUPPLY_CHAIN_FAILURES")).toBe(true);
      const info = findings.find((f) => f.title.includes("no lock file"));
      expect(info).toBeDefined();
      expect(info?.severity).toBe("INFO");
      expect(findings.find((f) => f.title.includes("express"))).toBeUndefined();
    });
  });
});
