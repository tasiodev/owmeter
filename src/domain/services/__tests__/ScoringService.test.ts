import { describe, it, expect } from "vitest";
import { calculateScore } from "../ScoringService";
import type { RawFinding } from "../ScoringService";
import { MAX_SCORE, PASSIVE_UNEVALUATED } from "@/domain/value-objects/OWASPCategory";

describe("calculateScore — PASSIVE mode (default)", () => {
  it("returns perfect score of 100 with no findings", () => {
    const { score, maxScore } = calculateScore([]);
    expect(score).toBe(MAX_SCORE);
    expect(maxScore).toBe(MAX_SCORE);
  });

  it("deducts correct points for a HIGH finding in evaluated category", () => {
    const findings: RawFinding[] = [
      {
        category: "A02_CRYPTOGRAPHIC_FAILURES",
        severity: "HIGH",
        title: "Missing HSTS",
        description: "No HSTS header",
      },
    ];
    const { score } = calculateScore(findings);
    expect(score).toBe(MAX_SCORE - 4); // HIGH = 4 pts lost
  });

  it("deducts correct points for a CRITICAL finding", () => {
    const findings: RawFinding[] = [
      {
        category: "A01_BROKEN_ACCESS_CONTROL",
        severity: "CRITICAL",
        title: "Exposed admin path",
        description: "Admin path accessible",
      },
    ];
    const { score } = calculateScore(findings);
    expect(score).toBe(MAX_SCORE - 6); // CRITICAL = 6 pts lost
  });

  it("caps category deduction at the category's maxPoints", () => {
    const findings: RawFinding[] = Array.from({ length: 5 }, () => ({
      category: "A07_AUTH_FAILURES" as const,
      severity: "CRITICAL" as const,
      title: "Auth failure",
      description: "Auth failure",
    }));
    const { categoryBreakdown } = calculateScore(findings);
    expect(categoryBreakdown.A07_AUTH_FAILURES.score).toBe(0);
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
    expect(score).toBe(MAX_SCORE);
  });

  it("score is never negative", () => {
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

  it("all PASSIVE_UNEVALUATED categories score at max in PASSIVE mode", () => {
    const { categoryBreakdown } = calculateScore([]);
    for (const id of PASSIVE_UNEVALUATED) {
      expect(categoryBreakdown[id].status).toBe("not_evaluated");
      expect(categoryBreakdown[id].score).toBe(categoryBreakdown[id].maxScore);
    }
  });

  it("not_evaluated categories ignore findings in PASSIVE mode", () => {
    const findings: RawFinding[] = [
      {
        category: "A04_INSECURE_DESIGN",
        severity: "CRITICAL",
        title: "Hardcoded secret",
        description: "desc",
      },
    ];
    const { score, categoryBreakdown } = calculateScore(findings, "PASSIVE");
    // A04 is not_evaluated in PASSIVE — no deduction
    expect(categoryBreakdown.A04_INSECURE_DESIGN.status).toBe("not_evaluated");
    expect(score).toBe(MAX_SCORE);
  });

  it("evaluated categories are marked as such", () => {
    const { categoryBreakdown } = calculateScore([]);
    expect(categoryBreakdown.A01_BROKEN_ACCESS_CONTROL.status).toBe("evaluated");
    expect(categoryBreakdown.A02_CRYPTOGRAPHIC_FAILURES.status).toBe("evaluated");
  });

  it("accumulates deductions across multiple findings in same category", () => {
    const findings: RawFinding[] = [
      { category: "A05_SECURITY_MISCONFIGURATION", severity: "LOW", title: "t1", description: "d" },
      { category: "A05_SECURITY_MISCONFIGURATION", severity: "LOW", title: "t2", description: "d" },
    ];
    const { categoryBreakdown } = calculateScore(findings);
    expect(categoryBreakdown.A05_SECURITY_MISCONFIGURATION.score).toBe(13); // 15 - 2
  });
});

describe("calculateScore — FULL mode", () => {
  it("returns maxScore of 100 with no findings", () => {
    const { score, maxScore } = calculateScore([], "FULL");
    expect(maxScore).toBe(MAX_SCORE);
    expect(score).toBe(MAX_SCORE);
  });

  it("deducts from A04 in FULL mode", () => {
    const findings: RawFinding[] = [
      {
        category: "A04_INSECURE_DESIGN",
        severity: "HIGH",
        title: "Hardcoded secret",
        description: "desc",
      },
    ];
    const { score, categoryBreakdown } = calculateScore(findings, "FULL");
    expect(categoryBreakdown.A04_INSECURE_DESIGN.status).toBe("evaluated");
    expect(categoryBreakdown.A04_INSECURE_DESIGN.maxScore).toBe(10);
    expect(categoryBreakdown.A04_INSECURE_DESIGN.score).toBe(6); // 10 - 4 (HIGH)
    expect(score).toBe(MAX_SCORE - 4);
  });

  it("deducts from A09 in FULL mode", () => {
    const findings: RawFinding[] = [
      {
        category: "A09_LOGGING_FAILURES",
        severity: "CRITICAL",
        title: "Logging password",
        description: "desc",
      },
    ];
    const { categoryBreakdown } = calculateScore(findings, "FULL");
    expect(categoryBreakdown.A09_LOGGING_FAILURES.status).toBe("evaluated");
    expect(categoryBreakdown.A09_LOGGING_FAILURES.score).toBe(9); // 15 - 6 (CRITICAL)
  });

  it("all categories are evaluated in FULL mode", () => {
    const { categoryBreakdown } = calculateScore([], "FULL");
    for (const entry of Object.values(categoryBreakdown)) {
      expect(entry.status).toBe("evaluated");
    }
  });
});

describe("calculateScore — CODE mode", () => {
  it("returns maxScore of 100 with no findings", () => {
    const { score, maxScore } = calculateScore([], "CODE");
    expect(maxScore).toBe(MAX_SCORE);
    expect(score).toBe(MAX_SCORE);
  });

  it("A05 is not_evaluated in CODE mode (requires live server)", () => {
    const { categoryBreakdown } = calculateScore([], "CODE");
    expect(categoryBreakdown.A05_SECURITY_MISCONFIGURATION.status).toBe("not_evaluated");
  });

  it("all categories except A05 are evaluated in CODE mode", () => {
    const { categoryBreakdown } = calculateScore([], "CODE");
    const others = Object.entries(categoryBreakdown).filter(([id]) => id !== "A05_SECURITY_MISCONFIGURATION");
    for (const [, entry] of others) {
      expect(entry.status).toBe("evaluated");
    }
  });

  it("deducts from code-specific categories in CODE mode", () => {
    const findings: RawFinding[] = [
      { category: "A08_DATA_INTEGRITY_FAILURES", severity: "HIGH", title: "Missing SRI", description: "desc" },
    ];
    const { score } = calculateScore(findings, "CODE");
    expect(score).toBe(MAX_SCORE - 4);
  });
});
