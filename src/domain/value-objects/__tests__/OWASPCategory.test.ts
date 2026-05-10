import { describe, it, expect } from "vitest";
import { OWASP_CATEGORIES, MAX_SCORE_WITHOUT_CODE } from "../OWASPCategory";

describe("OWASP_CATEGORIES", () => {
  it("has all 10 categories", () => {
    expect(Object.keys(OWASP_CATEGORIES)).toHaveLength(10);
  });

  it("each category has a non-empty name and non-negative maxPoints", () => {
    for (const cat of Object.values(OWASP_CATEGORIES)) {
      expect(cat.name).toBeTruthy();
      expect(cat.maxPoints).toBeGreaterThanOrEqual(0);
    }
  });

  it("code-only categories have 0 maxPoints", () => {
    expect(OWASP_CATEGORIES.A04_INSECURE_DESIGN.maxPoints).toBe(0);
    expect(OWASP_CATEGORIES.A08_DATA_INTEGRITY_FAILURES.maxPoints).toBe(0);
    expect(OWASP_CATEGORIES.A09_LOGGING_FAILURES.maxPoints).toBe(0);
  });

  it("scanning categories have positive maxPoints", () => {
    expect(OWASP_CATEGORIES.A02_CRYPTOGRAPHIC_FAILURES.maxPoints).toBe(15);
    expect(OWASP_CATEGORIES.A05_SECURITY_MISCONFIGURATION.maxPoints).toBe(15);
    expect(OWASP_CATEGORIES.A01_BROKEN_ACCESS_CONTROL.maxPoints).toBe(10);
    expect(OWASP_CATEGORIES.A07_AUTH_FAILURES.maxPoints).toBe(10);
    expect(OWASP_CATEGORIES.A03_INJECTION.maxPoints).toBe(8);
    expect(OWASP_CATEGORIES.A06_VULNERABLE_COMPONENTS.maxPoints).toBe(5);
    expect(OWASP_CATEGORIES.A10_SSRF.maxPoints).toBe(2);
  });
});

describe("MAX_SCORE_WITHOUT_CODE", () => {
  it("equals 65", () => {
    expect(MAX_SCORE_WITHOUT_CODE).toBe(65);
  });

  it("is the sum of all category maxPoints", () => {
    const sum = Object.values(OWASP_CATEGORIES).reduce((s, c) => s + c.maxPoints, 0);
    expect(MAX_SCORE_WITHOUT_CODE).toBe(sum);
  });
});
