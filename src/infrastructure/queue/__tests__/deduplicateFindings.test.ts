import { describe, it, expect } from "vitest";
import { deduplicateFindings } from "../scanQueue";
import type { RawFinding } from "@/domain/services/ScoringService";

const base: Omit<RawFinding, "title"> = {
  category: "A05_SECURITY_MISCONFIGURATION",
  severity: "MEDIUM",
  description: "desc",
};

describe("deduplicateFindings", () => {
  it("keeps a single finding unchanged", () => {
    const findings: RawFinding[] = [{ ...base, title: "Missing X-Content-Type-Options header" }];
    expect(deduplicateFindings(findings)).toHaveLength(1);
  });

  it("removes exact-title duplicates within the same category", () => {
    const findings: RawFinding[] = [
      { ...base, title: "Missing X-Content-Type-Options header" },
      { ...base, title: "Missing X-Content-Type-Options header" },
    ];
    expect(deduplicateFindings(findings)).toHaveLength(1);
  });

  it("keeps the first occurrence when deduplicating", () => {
    const first: RawFinding = { ...base, title: "Missing Content-Security-Policy header", description: "from passive" };
    const second: RawFinding = { ...base, title: "Missing Content-Security-Policy header", description: "from zap" };
    const result = deduplicateFindings([first, second]);
    expect(result).toHaveLength(1);
    expect(result[0].description).toBe("from passive");
  });

  it("collapses ZAP CSP alert to PassiveAnalyzer CSP finding", () => {
    const passive: RawFinding = { ...base, title: "Missing Content-Security-Policy header" };
    const zap: RawFinding = { ...base, title: "Content Security Policy (CSP) Header Not Set" };
    expect(deduplicateFindings([passive, zap])).toHaveLength(1);
  });

  it("collapses ZAP clickjacking alert to PassiveAnalyzer X-Frame-Options finding", () => {
    const passive: RawFinding = { ...base, title: "Missing X-Frame-Options header" };
    const zap: RawFinding = { ...base, title: "Missing Anti-clickjacking Header" };
    expect(deduplicateFindings([passive, zap])).toHaveLength(1);
  });

  it("collapses X-Frame-Options Header Not Set to PassiveAnalyzer equivalent", () => {
    const passive: RawFinding = { ...base, title: "Missing X-Frame-Options header" };
    const zap: RawFinding = { ...base, title: "X-Frame-Options Header Not Set" };
    expect(deduplicateFindings([passive, zap])).toHaveLength(1);
  });

  it("collapses ZAP HSTS alert to PassiveAnalyzer HSTS finding", () => {
    const passive: RawFinding = { ...base, title: "Missing Strict-Transport-Security (HSTS) header", severity: "HIGH" };
    const zap: RawFinding = { ...base, title: "Strict-Transport-Security Header Not Set", severity: "HIGH" };
    expect(deduplicateFindings([passive, zap])).toHaveLength(1);
  });

  it("keeps unrelated findings in the same category", () => {
    const findings: RawFinding[] = [
      { ...base, title: "Missing Content-Security-Policy header" },
      { ...base, title: "Missing X-Frame-Options header" },
      { ...base, title: "Sub Resource Integrity Attribute Missing" },
    ];
    expect(deduplicateFindings(findings)).toHaveLength(3);
  });

  it("keeps same title in different categories as separate findings", () => {
    const findings: RawFinding[] = [
      { ...base, category: "A02_CRYPTOGRAPHIC_FAILURES", title: "Weak cipher" },
      { ...base, category: "A05_SECURITY_MISCONFIGURATION", title: "Weak cipher" },
    ];
    expect(deduplicateFindings(findings)).toHaveLength(2);
  });

  it("handles an empty array", () => {
    expect(deduplicateFindings([])).toEqual([]);
  });
});
