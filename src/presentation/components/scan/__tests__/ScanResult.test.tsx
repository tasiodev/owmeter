import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScanResult } from "../ScanResult";
import type { Scan } from "@/domain/entities/Scan";

const now = new Date("2025-01-15T10:00:00Z");

function makeScan(overrides: Partial<Scan> = {}): Scan {
  return {
    id: "scan-1",
    projectId: "proj-1",
    type: "PASSIVE",
    status: "COMPLETED",
    score: 55,
    maxScore: 100,
    inRanking: false,
    errorMessage: null,
    findings: [],
    startedAt: now,
    completedAt: new Date("2025-01-15T10:05:00Z"),
    ...overrides,
  };
}

describe("ScanResult", () => {
  it("renders the score when scan is completed", () => {
    render(<ScanResult scan={makeScan()} />);
    expect(screen.getByText("55")).toBeInTheDocument();
  });

  it("shows RUNNING status badge", () => {
    render(<ScanResult scan={makeScan({ status: "RUNNING", score: null, maxScore: null, completedAt: null })} />);
    expect(screen.getByText("RUNNING")).toBeInTheDocument();
  });

  it("shows PENDING status badge", () => {
    render(<ScanResult scan={makeScan({ status: "PENDING", score: null, maxScore: null, completedAt: null })} />);
    expect(screen.getByText("PENDING")).toBeInTheDocument();
  });

  it("shows FAILED status badge", () => {
    render(<ScanResult scan={makeScan({ status: "FAILED", score: null, maxScore: null, completedAt: null })} />);
    expect(screen.getByText("FAILED")).toBeInTheDocument();
  });

  it("renders each finding with its title", () => {
    const scan = makeScan({
      findings: [
        {
          id: "f1",
          scanId: "scan-1",
          category: "A05_SECURITY_MISCONFIGURATION",
          severity: "MEDIUM",
          title: "Missing CSP Header",
          description: "No Content-Security-Policy found.",
          evidence: null,
          pointsLost: 2,
        },
        {
          id: "f2",
          scanId: "scan-1",
          category: "A02_CRYPTOGRAPHIC_FAILURES",
          severity: "HIGH",
          title: "Missing HSTS",
          description: "No HSTS header.",
          evidence: null,
          pointsLost: 4,
        },
      ],
    });

    render(<ScanResult scan={scan} />);

    expect(screen.getByText("Missing CSP Header")).toBeInTheDocument();
    expect(screen.getByText("Missing HSTS")).toBeInTheDocument();
  });

  it("shows point deduction for each finding", () => {
    const scan = makeScan({
      findings: [
        {
          id: "f1",
          scanId: "scan-1",
          // A05 is evaluated in PASSIVE mode (not in PASSIVE_UNEVALUATED)
          category: "A05_SECURITY_MISCONFIGURATION",
          severity: "CRITICAL",
          title: "Missing Security Headers",
          description: "Critical misconfiguration",
          evidence: null,
          pointsLost: 6,
        },
      ],
    });

    render(<ScanResult scan={scan} />);
    expect(screen.getAllByText("-6 pts").length).toBeGreaterThanOrEqual(1);
  });

  it("shows evidence when present", () => {
    const scan = makeScan({
      findings: [
        {
          id: "f1",
          scanId: "scan-1",
          category: "A05_SECURITY_MISCONFIGURATION",
          severity: "LOW",
          title: "Server leaks version",
          description: "desc",
          evidence: "server: Apache/2.4.51",
          pointsLost: 1,
        },
      ],
    });

    render(<ScanResult scan={scan} />);
    expect(screen.getByText("server: Apache/2.4.51")).toBeInTheDocument();
  });

  it("does not render findings section when findings is empty", () => {
    render(<ScanResult scan={makeScan({ findings: [] })} />);
    // The category breakdown list is always present; the findings list should not be
    expect(screen.getAllByRole("list")).toHaveLength(1);
  });
});
