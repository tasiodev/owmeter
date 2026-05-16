import { describe, it, expect } from "vitest";
import { zipSync, strToU8 } from "fflate";
import { runSourceCodeAnalysis } from "../SourceCodeAnalyzer";

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
  it("returns empty array for safe code", async () => {
    const zip = makeZip({ "index.ts": "export const greeting = 'hello world';" });
    const findings = await runSourceCodeAnalysis(zip);
    expect(findings).toHaveLength(0);
  });

  it("detects eval() → A03_INJECTION CRITICAL", async () => {
    const zip = makeZip({ "utils.js": "function run(code) { eval(code); }" });
    const findings = await runSourceCodeAnalysis(zip);
    const f = findings.find((f) => f.title.includes("eval"));
    expect(f).toBeDefined();
    expect(f?.category).toBe("A03_INJECTION");
    expect(f?.severity).toBe("CRITICAL");
  });

  it("detects SQL injection via template literal → A03_INJECTION CRITICAL", async () => {
    const zip = makeZip({
      "db.ts": "const q = `SELECT * FROM users WHERE id = ${userId}`;",
    });
    const findings = await runSourceCodeAnalysis(zip);
    const f = findings.find((f) => f.title.includes("SQL injection"));
    expect(f).toBeDefined();
    expect(f?.category).toBe("A03_INJECTION");
    expect(f?.severity).toBe("CRITICAL");
  });

  it("detects CORS wildcard → A01_BROKEN_ACCESS_CONTROL HIGH", async () => {
    const zip = makeZip({
      "server.js": "app.use(cors({ origin: '*' }));",
    });
    const findings = await runSourceCodeAnalysis(zip);
    const f = findings.find((f) => f.title.includes("CORS"));
    expect(f).toBeDefined();
    expect(f?.category).toBe("A01_BROKEN_ACCESS_CONTROL");
  });

  it("detects MD5 hashing → A02_CRYPTOGRAPHIC_FAILURES HIGH", async () => {
    const zip = makeZip({
      "hash.js": "const h = crypto.createHash('md5').update(data).digest('hex');",
    });
    const findings = await runSourceCodeAnalysis(zip);
    const f = findings.find((f) => f.title.includes("MD5"));
    expect(f).toBeDefined();
    expect(f?.category).toBe("A02_CRYPTOGRAPHIC_FAILURES");
    expect(f?.severity).toBe("HIGH");
  });

  it("detects hardcoded password → A04_INSECURE_DESIGN CRITICAL", async () => {
    const zip = makeZip({
      "config.ts": "const password = 'super-secret-password-123';",
    });
    const findings = await runSourceCodeAnalysis(zip);
    const f = findings.find((f) => f.title.includes("Hardcoded password"));
    expect(f).toBeDefined();
    expect(f?.category).toBe("A04_INSECURE_DESIGN");
    expect(f?.severity).toBe("CRITICAL");
  });

  it("does not flag hardcoded values in .env.example files", async () => {
    const zip = makeZip({
      ".env.example": "password=your-password-here",
    });
    const findings = await runSourceCodeAnalysis(zip);
    const f = findings.find((f) => f.title.includes("Hardcoded password"));
    expect(f).toBeUndefined();
  });

  it("detects logging sensitive data → A09_LOGGING_FAILURES HIGH", async () => {
    const zip = makeZip({
      "auth.ts": "console.log('user password:', password);",
    });
    const findings = await runSourceCodeAnalysis(zip);
    const f = findings.find((f) => f.title.includes("Logging sensitive"));
    expect(f).toBeDefined();
    expect(f?.category).toBe("A09_LOGGING_FAILURES");
    expect(f?.severity).toBe("HIGH");
  });

  it("detects empty catch block → A09_LOGGING_FAILURES MEDIUM", async () => {
    const zip = makeZip({
      "handler.ts": "try { doSomething(); } catch (err) {}",
    });
    const findings = await runSourceCodeAnalysis(zip);
    const f = findings.find((f) => f.title.includes("Empty catch"));
    expect(f).toBeDefined();
    expect(f?.category).toBe("A09_LOGGING_FAILURES");
    expect(f?.severity).toBe("MEDIUM");
  });

  it("detects missing SRI on external script in HTML → A08_DATA_INTEGRITY_FAILURES", async () => {
    const zip = makeZip({
      "index.html": '<html><script src="https://cdn.example.com/lib.js"></script></html>',
    });
    const findings = await runSourceCodeAnalysis(zip);
    const f = findings.find((f) => f.title.includes("Subresource Integrity"));
    expect(f).toBeDefined();
    expect(f?.category).toBe("A08_DATA_INTEGRITY_FAILURES");
  });

  it("does not flag internal (same-origin) scripts for missing SRI", async () => {
    const zip = makeZip({
      "index.html": '<html><script src="/_next/static/chunks/main.js"></script></html>',
    });
    const findings = await runSourceCodeAnalysis(zip);
    const f = findings.find((f) => f.title.includes("Subresource Integrity"));
    expect(f).toBeUndefined();
  });

  it("does not flag external script that already has integrity attribute", async () => {
    const zip = makeZip({
      "index.html":
        '<html><script src="https://cdn.example.com/lib.js" integrity="sha384-abc123" crossorigin="anonymous"></script></html>',
    });
    const findings = await runSourceCodeAnalysis(zip);
    const f = findings.find((f) => f.title.includes("Subresource Integrity"));
    expect(f).toBeUndefined();
  });

  it("skips files in node_modules/", async () => {
    const zip = makeZip({
      "node_modules/some-lib/index.js": "eval('bad code');",
    });
    const findings = await runSourceCodeAnalysis(zip);
    expect(findings).toHaveLength(0);
  });

  it("skips files in .git/", async () => {
    const zip = makeZip({
      ".git/config": "password=secret-in-git-config",
    });
    const findings = await runSourceCodeAnalysis(zip);
    // .git/ is skipped and .config is not an allowed extension
    expect(findings).toHaveLength(0);
  });

  it("skips files in .next/", async () => {
    const zip = makeZip({
      ".next/server/chunks/app.js": "eval('client code');",
    });
    const findings = await runSourceCodeAnalysis(zip);
    expect(findings).toHaveLength(0);
  });

  it("handles GitHub ZIP format with root folder prefix", async () => {
    const zip = makeGitHubZip({
      "app.ts": "const password = 'hardcoded-secret-123';",
    });
    const findings = await runSourceCodeAnalysis(zip);
    expect(findings.some((f) => f.title.includes("Hardcoded password"))).toBe(true);
  });

  it("detects localStorage.setItem with token key → A02_CRYPTOGRAPHIC_FAILURES HIGH", async () => {
    const zip = makeZip({
      "auth.ts": "localStorage.setItem('access_token', response.token);",
    });
    const findings = await runSourceCodeAnalysis(zip);
    const f = findings.find((f) => f.title.includes("web storage"));
    expect(f).toBeDefined();
    expect(f?.category).toBe("A02_CRYPTOGRAPHIC_FAILURES");
    expect(f?.severity).toBe("HIGH");
  });

  it("detects sessionStorage.setItem with jwt key → A02_CRYPTOGRAPHIC_FAILURES HIGH", async () => {
    const zip = makeZip({
      "session.ts": "sessionStorage.setItem('jwt', token);",
    });
    const findings = await runSourceCodeAnalysis(zip);
    const f = findings.find((f) => f.title.includes("web storage"));
    expect(f).toBeDefined();
    expect(f?.category).toBe("A02_CRYPTOGRAPHIC_FAILURES");
  });

  it("does not flag localStorage.setItem with non-sensitive key", async () => {
    const zip = makeZip({
      "ui.ts": "localStorage.setItem('theme', 'dark');",
    });
    const findings = await runSourceCodeAnalysis(zip);
    const f = findings.find((f) => f.title.includes("web storage"));
    expect(f).toBeUndefined();
  });

  it("detects vulnerable dependency → A06_VULNERABLE_COMPONENTS", async () => {
    const zip = makeZip({
      "package.json": JSON.stringify({
        dependencies: { jsonwebtoken: "^8.5.0" },
      }),
    });
    const findings = await runSourceCodeAnalysis(zip);
    const f = findings.find((f) => f.title.includes("jsonwebtoken"));
    expect(f).toBeDefined();
    expect(f?.category).toBe("A06_VULNERABLE_COMPONENTS");
  });

  it("does not flag up-to-date dependencies", async () => {
    const zip = makeZip({
      "package.json": JSON.stringify({
        dependencies: { jsonwebtoken: "^9.0.2" },
      }),
    });
    const findings = await runSourceCodeAnalysis(zip);
    const f = findings.find((f) => f.title.includes("jsonwebtoken"));
    expect(f).toBeUndefined();
  });
});
