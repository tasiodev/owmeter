import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
          category: "A02_SECURITY_MISCONFIGURATION",
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
          category: "A02_SECURITY_MISCONFIGURATION",
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
          category: "A02_SECURITY_MISCONFIGURATION",
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

const codeFinding = {
  id: "f1",
  scanId: "scan-1",
  category: "A03_INJECTION" as const,
  severity: "HIGH" as const,
  title: "SQL Injection via template literal",
  description: "Template literal used in query.",
  evidence: "src/db.ts:42 — query = `SELECT * FROM ${table}`",
  pointsLost: 4,
};

describe("ScanResult — false positive status on findings", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("shows the 'Report FP' button when no FP status is set", () => {
    const scan = makeScan({ findings: [codeFinding] });
    render(<ScanResult scan={scan} projectId="proj-1" />);
    expect(screen.getByRole("button", { name: /scan\.reportFP/i })).toBeInTheDocument();
  });

  it("shows 'already reported' badge and hides button when fpStatus is PENDING", () => {
    const scan = makeScan({ findings: [codeFinding] });
    const reportedFpKeys = new Map([
      ["A03_INJECTION:SQL Injection via template literal:src/db.ts", "PENDING"],
    ]);
    render(<ScanResult scan={scan} projectId="proj-1" reportedFpKeys={reportedFpKeys} />);

    expect(screen.getByText("scan.fpModal.alreadyReported")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /scan\.reportFP/i })).not.toBeInTheDocument();
  });

  it("shows rejected badge and re-enables the Report FP button when fpStatus is REJECTED", () => {
    const scan = makeScan({ findings: [codeFinding] });
    const reportedFpKeys = new Map([
      ["A03_INJECTION:SQL Injection via template literal:src/db.ts", "REJECTED"],
    ]);
    render(<ScanResult scan={scan} projectId="proj-1" reportedFpKeys={reportedFpKeys} />);

    expect(screen.getByText("scan.rejectedFpBadge")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /scan\.reportFP/i })).toBeInTheDocument();
  });
});

describe("ScanResult — suppressed findings (approved FPs)", () => {
  it("does not show the suppressed banner when there are no approved FPs", () => {
    const scan = makeScan({ findings: [codeFinding] });
    render(<ScanResult scan={scan} projectId="proj-1" />);
    expect(screen.queryByText(/scan\.suppressedBanner/)).not.toBeInTheDocument();
  });

  it("shows the suppressed banner when an approved FP key matches a finding", () => {
    const scan = makeScan({ findings: [codeFinding] });
    const approvedFpKeys = new Set(["A03_INJECTION:SQL Injection via template literal:src/db.ts"]);
    render(<ScanResult scan={scan} projectId="proj-1" approvedFpKeys={approvedFpKeys} />);
    expect(screen.getByText(/scan\.suppressedBanner/)).toBeInTheDocument();
  });

  it("hides suppressed findings by default and shows them after clicking Show", async () => {
    const scan = makeScan({ findings: [codeFinding] });
    const approvedFpKeys = new Set(["A03_INJECTION:SQL Injection via template literal:src/db.ts"]);
    render(<ScanResult scan={scan} projectId="proj-1" approvedFpKeys={approvedFpKeys} />);

    // Finding should not appear in the active list
    expect(screen.queryByText("SQL Injection via template literal")).not.toBeInTheDocument();

    // Click "Show"
    await userEvent.click(screen.getByRole("button", { name: /scan\.suppressedShow/i }));

    expect(screen.getByText("SQL Injection via template literal")).toBeInTheDocument();
  });

  it("shows the approved FP badge on a suppressed finding", async () => {
    const scan = makeScan({ findings: [codeFinding] });
    const approvedFpKeys = new Set(["A03_INJECTION:SQL Injection via template literal:src/db.ts"]);
    render(<ScanResult scan={scan} projectId="proj-1" approvedFpKeys={approvedFpKeys} />);

    await userEvent.click(screen.getByRole("button", { name: /scan\.suppressedShow/i }));

    expect(screen.getByText("scan.approvedFpBadge")).toBeInTheDocument();
  });

  it("hides suppressed findings again after clicking Hide", async () => {
    const scan = makeScan({ findings: [codeFinding] });
    const approvedFpKeys = new Set(["A03_INJECTION:SQL Injection via template literal:src/db.ts"]);
    render(<ScanResult scan={scan} projectId="proj-1" approvedFpKeys={approvedFpKeys} />);

    await userEvent.click(screen.getByRole("button", { name: /scan\.suppressedShow/i }));
    expect(screen.getByText("SQL Injection via template literal")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /scan\.suppressedHide/i }));
    expect(screen.queryByText("SQL Injection via template literal")).not.toBeInTheDocument();
  });
});
