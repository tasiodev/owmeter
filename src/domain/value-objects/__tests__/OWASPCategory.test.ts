import { describe, it, expect } from "vitest";
import { OWASP_CATEGORIES, PASSIVE_UNEVALUATED, PASSIVE_PARTIAL, CODE_UNEVALUATED, CODE_PARTIAL, isEvaluated, evaluationLevel, MAX_SCORE } from "../OWASPCategory";

describe("OWASP_CATEGORIES", () => {
  it("has all 10 categories", () => {
    expect(Object.keys(OWASP_CATEGORIES)).toHaveLength(10);
  });

  it("all categories have positive maxPoints", () => {
    for (const cat of Object.values(OWASP_CATEGORIES)) {
      expect(cat.maxPoints).toBeGreaterThan(0);
    }
  });

  it("total maxPoints sum to 100", () => {
    const total = Object.values(OWASP_CATEGORIES).reduce((s, c) => s + c.maxPoints, 0);
    expect(total).toBe(MAX_SCORE);
  });

  it("scanning categories have correct maxPoints", () => {
    expect(OWASP_CATEGORIES.A02_CRYPTOGRAPHIC_FAILURES.maxPoints).toBe(15);
    expect(OWASP_CATEGORIES.A05_SECURITY_MISCONFIGURATION.maxPoints).toBe(15);
    expect(OWASP_CATEGORIES.A01_BROKEN_ACCESS_CONTROL.maxPoints).toBe(10);
    expect(OWASP_CATEGORIES.A07_AUTH_FAILURES.maxPoints).toBe(10);
    expect(OWASP_CATEGORIES.A04_INSECURE_DESIGN.maxPoints).toBe(10);
    expect(OWASP_CATEGORIES.A03_INJECTION.maxPoints).toBe(8);
    expect(OWASP_CATEGORIES.A06_VULNERABLE_COMPONENTS.maxPoints).toBe(5);
    expect(OWASP_CATEGORIES.A10_SSRF.maxPoints).toBe(2);
  });
});

describe("evaluationLevel — PASSIVE mode", () => {
  it("PASSIVE_UNEVALUATED categories return 'none'", () => {
    for (const id of PASSIVE_UNEVALUATED) {
      expect(evaluationLevel(id, "PASSIVE")).toBe("none");
      expect(isEvaluated(id, "PASSIVE")).toBe(false);
    }
  });

  it("PASSIVE_PARTIAL categories return 'partial' and count as evaluated", () => {
    for (const id of PASSIVE_PARTIAL) {
      expect(evaluationLevel(id, "PASSIVE")).toBe("partial");
      expect(isEvaluated(id, "PASSIVE")).toBe(true);
    }
  });

  it("A01/A02/A03/A07/A10 are partial — ZAP covers public surface, code covers the rest", () => {
    expect(evaluationLevel("A01_BROKEN_ACCESS_CONTROL", "PASSIVE")).toBe("partial");
    expect(evaluationLevel("A02_CRYPTOGRAPHIC_FAILURES", "PASSIVE")).toBe("partial");
    expect(evaluationLevel("A03_INJECTION", "PASSIVE")).toBe("partial");
    expect(evaluationLevel("A07_AUTH_FAILURES", "PASSIVE")).toBe("partial");
    expect(evaluationLevel("A10_SSRF", "PASSIVE")).toBe("partial");
  });

  it("A05 is fully evaluated in PASSIVE mode — server config is entirely externally visible", () => {
    expect(evaluationLevel("A05_SECURITY_MISCONFIGURATION", "PASSIVE")).toBe("full");
  });

  it("source-code-only categories are not evaluated", () => {
    expect(isEvaluated("A04_INSECURE_DESIGN", "PASSIVE")).toBe(false);
    expect(isEvaluated("A06_VULNERABLE_COMPONENTS", "PASSIVE")).toBe(false);
    expect(isEvaluated("A08_DATA_INTEGRITY_FAILURES", "PASSIVE")).toBe(false);
    expect(isEvaluated("A09_LOGGING_FAILURES", "PASSIVE")).toBe(false);
  });
});

describe("evaluationLevel — FULL mode", () => {
  it("all categories are evaluated", () => {
    for (const id of Object.keys(OWASP_CATEGORIES) as (keyof typeof OWASP_CATEGORIES)[]) {
      expect(isEvaluated(id, "FULL")).toBe(true);
      expect(evaluationLevel(id, "FULL")).toBe("full");
    }
  });
});

describe("evaluationLevel — CODE mode", () => {
  it("CODE_UNEVALUATED categories return 'none'", () => {
    for (const id of CODE_UNEVALUATED) {
      expect(isEvaluated(id, "CODE")).toBe(false);
    }
  });

  it("A05 is not evaluated in CODE mode — requires live server", () => {
    expect(evaluationLevel("A05_SECURITY_MISCONFIGURATION", "CODE")).toBe("none");
  });

  it("CODE_PARTIAL categories return 'partial' and count as evaluated", () => {
    for (const id of CODE_PARTIAL) {
      expect(evaluationLevel(id, "CODE")).toBe("partial");
      expect(isEvaluated(id, "CODE")).toBe(true);
    }
  });

  it("A01/A02/A07 are partial in CODE mode — code checks limited patterns, runtime gaps remain", () => {
    expect(evaluationLevel("A01_BROKEN_ACCESS_CONTROL", "CODE")).toBe("partial");
    expect(evaluationLevel("A02_CRYPTOGRAPHIC_FAILURES", "CODE")).toBe("partial");
    expect(evaluationLevel("A07_AUTH_FAILURES", "CODE")).toBe("partial");
  });

  it("categories not in CODE_UNEVALUATED or CODE_PARTIAL are fully evaluated", () => {
    expect(evaluationLevel("A03_INJECTION", "CODE")).toBe("full");
    expect(evaluationLevel("A06_VULNERABLE_COMPONENTS", "CODE")).toBe("full");
  });
});

describe("MAX_SCORE", () => {
  it("equals 100", () => {
    expect(MAX_SCORE).toBe(100);
  });
});
