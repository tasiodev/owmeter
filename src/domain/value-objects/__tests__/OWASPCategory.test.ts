import { describe, it, expect } from "vitest";
import {
  OWASP_CATEGORIES,
  OWASP_CATEGORIES_COMPLETE,
  MAX_SCORE_WITHOUT_CODE,
  MAX_SCORE_WITH_CODE,
  getCategoryMap,
  getMaxScore,
} from "../OWASPCategory";

describe("OWASP_CATEGORIES (BASIC)", () => {
  it("has all 10 categories", () => {
    expect(Object.keys(OWASP_CATEGORIES)).toHaveLength(10);
  });

  it("each category has a non-empty name and non-negative maxPoints", () => {
    for (const cat of Object.values(OWASP_CATEGORIES)) {
      expect(cat.name).toBeTruthy();
      expect(cat.maxPoints).toBeGreaterThanOrEqual(0);
    }
  });

  it("code-only categories have 0 maxPoints in BASIC mode", () => {
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

describe("OWASP_CATEGORIES_COMPLETE", () => {
  it("has correct maxPoints for code-only categories", () => {
    expect(OWASP_CATEGORIES_COMPLETE.A04_INSECURE_DESIGN.maxPoints).toBe(10);
    expect(OWASP_CATEGORIES_COMPLETE.A08_DATA_INTEGRITY_FAILURES.maxPoints).toBe(10);
    expect(OWASP_CATEGORIES_COMPLETE.A09_LOGGING_FAILURES.maxPoints).toBe(15);
  });

  it("sums to 100", () => {
    const sum = Object.values(OWASP_CATEGORIES_COMPLETE).reduce((s, c) => s + c.maxPoints, 0);
    expect(sum).toBe(100);
  });

  it("preserves non-code categories unchanged", () => {
    expect(OWASP_CATEGORIES_COMPLETE.A01_BROKEN_ACCESS_CONTROL.maxPoints).toBe(10);
    expect(OWASP_CATEGORIES_COMPLETE.A02_CRYPTOGRAPHIC_FAILURES.maxPoints).toBe(15);
  });
});

describe("MAX_SCORE_WITHOUT_CODE", () => {
  it("equals 65", () => {
    expect(MAX_SCORE_WITHOUT_CODE).toBe(65);
  });

  it("is the sum of all BASIC category maxPoints", () => {
    const sum = Object.values(OWASP_CATEGORIES).reduce((s, c) => s + c.maxPoints, 0);
    expect(MAX_SCORE_WITHOUT_CODE).toBe(sum);
  });
});

describe("MAX_SCORE_WITH_CODE", () => {
  it("equals 100", () => {
    expect(MAX_SCORE_WITH_CODE).toBe(100);
  });
});

describe("getCategoryMap", () => {
  it("returns BASIC map when mode is BASIC", () => {
    const map = getCategoryMap("BASIC");
    expect(map.A04_INSECURE_DESIGN.maxPoints).toBe(0);
  });

  it("returns COMPLETE map when mode is COMPLETE", () => {
    const map = getCategoryMap("COMPLETE");
    expect(map.A04_INSECURE_DESIGN.maxPoints).toBe(10);
  });
});

describe("getMaxScore", () => {
  it("returns 65 for BASIC mode", () => {
    expect(getMaxScore("BASIC")).toBe(65);
  });

  it("returns 100 for COMPLETE mode", () => {
    expect(getMaxScore("COMPLETE")).toBe(100);
  });
});
