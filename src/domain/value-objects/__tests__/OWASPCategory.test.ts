import { describe, it, expect } from "vitest";
import { OWASP_CATEGORIES, PASSIVE_UNEVALUATED, CODE_UNEVALUATED, isEvaluated, MAX_SCORE } from "../OWASPCategory";

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

describe("isEvaluated", () => {
  it("PASSIVE_UNEVALUATED categories return false in PASSIVE mode", () => {
    for (const id of PASSIVE_UNEVALUATED) {
      expect(isEvaluated(id, "PASSIVE")).toBe(false);
    }
  });

  it("header/server categories are evaluated in PASSIVE mode", () => {
    expect(isEvaluated("A01_BROKEN_ACCESS_CONTROL", "PASSIVE")).toBe(true);
    expect(isEvaluated("A02_CRYPTOGRAPHIC_FAILURES", "PASSIVE")).toBe(true);
    expect(isEvaluated("A05_SECURITY_MISCONFIGURATION", "PASSIVE")).toBe(true);
    expect(isEvaluated("A07_AUTH_FAILURES", "PASSIVE")).toBe(true);
  });

  it("code-dependent categories are not evaluated in PASSIVE mode", () => {
    expect(isEvaluated("A03_INJECTION", "PASSIVE")).toBe(false);
    expect(isEvaluated("A06_VULNERABLE_COMPONENTS", "PASSIVE")).toBe(false);
    expect(isEvaluated("A10_SSRF", "PASSIVE")).toBe(false);
  });

  it("all categories return true in FULL mode", () => {
    for (const id of Object.keys(OWASP_CATEGORIES) as (keyof typeof OWASP_CATEGORIES)[]) {
      expect(isEvaluated(id, "FULL")).toBe(true);
    }
  });

  it("CODE_UNEVALUATED categories return false in CODE mode", () => {
    for (const id of CODE_UNEVALUATED) {
      expect(isEvaluated(id, "CODE")).toBe(false);
    }
  });

  it("A05 is not evaluated in CODE mode (requires live server)", () => {
    expect(isEvaluated("A05_SECURITY_MISCONFIGURATION", "CODE")).toBe(false);
  });

  it("non-CODE_UNEVALUATED categories return true in CODE mode", () => {
    expect(isEvaluated("A01_BROKEN_ACCESS_CONTROL", "CODE")).toBe(true);
    expect(isEvaluated("A03_INJECTION", "CODE")).toBe(true);
    expect(isEvaluated("A06_VULNERABLE_COMPONENTS", "CODE")).toBe(true);
  });
});

describe("MAX_SCORE", () => {
  it("equals 100", () => {
    expect(MAX_SCORE).toBe(100);
  });
});
