import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { runPassiveAnalysis } from "../PassiveAnalyzer";

function makeResponse(headers: Record<string, string> = {}, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (key: string) => headers[key.toLowerCase()] ?? null,
      forEach: (cb: (value: string, key: string) => void) => {
        Object.entries(headers).forEach(([k, v]) => cb(v, k.toLowerCase()));
      },
    },
    text: async () => "",
  };
}

function mockFetch(responses: Array<{ status?: number; headers?: Record<string, string> }>) {
  let call = 0;
  return vi.fn().mockImplementation(() => {
    const r = responses[call] ?? responses[responses.length - 1];
    call++;
    return Promise.resolve(makeResponse(r.headers ?? {}, r.status ?? 200));
  });
}

const FULL_HEADERS: Record<string, string> = {
  "strict-transport-security": "max-age=63072000",
  "content-security-policy": "default-src 'self'",
  "x-frame-options": "SAMEORIGIN",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=()",
};

describe("runPassiveAnalysis", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it("returns no security-header findings when all headers are present", async () => {
    vi.stubGlobal("fetch", mockFetch([{ headers: FULL_HEADERS }]));

    const findings = await runPassiveAnalysis("https://example.com");

    const headerFindings = findings.filter(
      (f) =>
        f.title.includes("Missing") &&
        [
          "strict-transport-security",
          "content-security-policy",
          "x-frame-options",
          "x-content-type-options",
          "referrer-policy",
          "permissions-policy",
        ].some((h) => f.title.toLowerCase().includes(h))
    );
    expect(headerFindings).toHaveLength(0);
  });

  it("reports missing CSP header as MEDIUM severity", async () => {
    const headers = { ...FULL_HEADERS };
    delete headers["content-security-policy"];

    vi.stubGlobal("fetch", mockFetch([{ headers }]));

    const findings = await runPassiveAnalysis("https://example.com");
    const cspFinding = findings.find((f) => f.title.includes("Content-Security-Policy"));

    expect(cspFinding).toBeDefined();
    expect(cspFinding?.severity).toBe("MEDIUM");
    expect(cspFinding?.category).toBe("A05_SECURITY_MISCONFIGURATION");
  });

  it("reports missing HSTS header as HIGH severity", async () => {
    const headers = { ...FULL_HEADERS };
    delete headers["strict-transport-security"];

    vi.stubGlobal("fetch", mockFetch([{ headers }]));

    const findings = await runPassiveAnalysis("https://example.com");
    const hstsFinding = findings.find((f) => f.title.includes("Strict-Transport-Security"));

    expect(hstsFinding).toBeDefined();
    expect(hstsFinding?.severity).toBe("HIGH");
    expect(hstsFinding?.category).toBe("A02_CRYPTOGRAPHIC_FAILURES");
  });

  it("reports missing X-Frame-Options as MEDIUM severity", async () => {
    const headers = { ...FULL_HEADERS };
    delete headers["x-frame-options"];

    vi.stubGlobal("fetch", mockFetch([{ headers }]));

    const findings = await runPassiveAnalysis("https://example.com");
    const frameFinding = findings.find((f) => f.title.includes("X-Frame-Options"));

    expect(frameFinding).toBeDefined();
    expect(frameFinding?.severity).toBe("MEDIUM");
  });

  it("reports server header info leak as LOW severity", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch([{ headers: { ...FULL_HEADERS, server: "Apache/2.4.51" } }])
    );

    const findings = await runPassiveAnalysis("https://example.com");
    const serverFinding = findings.find((f) => f.title.includes("server"));

    expect(serverFinding).toBeDefined();
    expect(serverFinding?.severity).toBe("LOW");
    expect(serverFinding?.category).toBe("A05_SECURITY_MISCONFIGURATION");
  });

  it("reports cookie missing HttpOnly as MEDIUM severity", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch([
        { headers: { ...FULL_HEADERS, "set-cookie": "session=abc123; Path=/; Secure; SameSite=Strict" } },
      ])
    );

    const findings = await runPassiveAnalysis("https://example.com");
    const cookieFinding = findings.find((f) => f.title.includes("HttpOnly"));

    expect(cookieFinding).toBeDefined();
    expect(cookieFinding?.severity).toBe("MEDIUM");
    expect(cookieFinding?.category).toBe("A07_AUTH_FAILURES");
  });

  it("reports CRITICAL finding when target URL is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));

    const findings = await runPassiveAnalysis("https://unreachable.example.com");

    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe("CRITICAL");
    expect(findings[0].category).toBe("A05_SECURITY_MISCONFIGURATION");
  });

  it("returns an array (even if empty) on success", async () => {
    vi.stubGlobal("fetch", mockFetch([{ headers: FULL_HEADERS }]));
    const findings = await runPassiveAnalysis("https://example.com");
    expect(Array.isArray(findings)).toBe(true);
  });
});
