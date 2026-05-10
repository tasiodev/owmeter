import { describe, it, expect } from "vitest";
import { calculateScore } from "../ScoringService";
import type { RawFinding } from "../ScoringService";
import { MAX_SCORE_WITHOUT_CODE } from "@/domain/value-objects/OWASPCategory";

describe("calculateScore", () => {
  it("returns perfect score with no findings", () => {
    const { score, maxScore } = calculateScore([]);
    expect(score).toBe(MAX_SCORE_WITHOUT_CODE);
    expect(maxScore).toBe(MAX_SCORE_WITHOUT_CODE);
  });

  it("deducts correct points for a HIGH finding", () => {
    const findings: RawFinding[] = [
      {
        category: "A02_CRYPTOGRAPHIC_FAILURES",
        severity: "HIGH",
        title: "Missing HSTS",
        description: "No HSTS header",
      },
    ];
    const { score } = calculateScore(findings);
    expect(score).toBe(MAX_SCORE_WITHOUT_CODE - 4); // HIGH = 4 pts lost
  });

  it("deducts correct points for a CRITICAL finding", () => {
    const findings: RawFinding[] = [
      {
        category: "A03_INJECTION",
        severity: "CRITICAL",
        title: "SQL Injection",
        description: "Found SQL injection",
      },
    ];
    const { score } = calculateScore(findings);
    expect(score).toBe(MAX_SCORE_WITHOUT_CODE - 6); // CRITICAL = 6 pts lost
  });

  it("caps category deduction at the category's maxPoints", () => {
    // A10_SSRF maxPoints = 2; add many CRITICAL findings in that category
    const findings: RawFinding[] = Array.from({ length: 5 }, () => ({
      category: "A10_SSRF" as const,
      severity: "CRITICAL" as const,
      title: "SSRF",
      description: "SSRF",
    }));
    const { categoryBreakdown } = calculateScore(findings);
    expect(categoryBreakdown.A10_SSRF.score).toBe(0); // floored at 0
  });

  it("INFO findings cost 0 points", () => {
    const findings: RawFinding[] = [
      {
        category: "A05_SECURITY_MISCONFIGURATION",
        severity: "INFO",
        title: "Info finding",
        description: "Informational",
      },
    ];
    const { score } = calculateScore(findings);
    expect(score).toBe(MAX_SCORE_WITHOUT_CODE);
  });

  it("score is never negative", () => {
    // Pile on maximum findings across every category
    const findings: RawFinding[] = Array.from({ length: 100 }, (_, i) => ({
      category: "A05_SECURITY_MISCONFIGURATION" as const,
      severity: "CRITICAL" as const,
      title: `Finding ${i}`,
      description: "desc",
    }));
    const { score } = calculateScore(findings);
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it("returns findings with pointsLost attached", () => {
    const findings: RawFinding[] = [
      {
        category: "A07_AUTH_FAILURES",
        severity: "MEDIUM",
        title: "Cookie missing SameSite",
        description: "desc",
      },
    ];
    const { findings: scored } = calculateScore(findings);
    expect(scored[0].pointsLost).toBe(2); // MEDIUM = 2
  });

  it("accumulates deductions across multiple findings in same category", () => {
    const findings: RawFinding[] = [
      { category: "A05_SECURITY_MISCONFIGURATION", severity: "LOW", title: "t1", description: "d" },
      { category: "A05_SECURITY_MISCONFIGURATION", severity: "LOW", title: "t2", description: "d" },
    ];
    // A05 maxPoints = 15; two LOW = 2 pts lost
    const { categoryBreakdown } = calculateScore(findings);
    expect(categoryBreakdown.A05_SECURITY_MISCONFIGURATION.score).toBe(13);
  });
});
