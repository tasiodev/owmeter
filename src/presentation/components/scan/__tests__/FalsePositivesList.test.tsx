import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FalsePositivesList } from "../FalsePositivesList";
import type { FalsePositiveReport } from "@/domain/entities/FalsePositiveReport";

const now = new Date("2025-01-15T10:00:00Z");

function makeReport(overrides: Partial<FalsePositiveReport> = {}): FalsePositiveReport {
  return {
    id: "fp-1",
    projectId: "proj-1",
    reportedById: "user-1",
    category: "A03_INJECTION",
    title: "SQL Injection via template literal",
    filePath: "src/db.ts",
    evidence: "src/db.ts:42 — query snippet",
    reason: "This is a test helper, not production code.",
    status: "PENDING",
    reviewedById: null,
    reviewedAt: null,
    adminNote: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("FalsePositivesList", () => {
  it("shows the empty message when there are no reports", () => {
    render(<FalsePositivesList reports={[]} />);
    expect(screen.getByText("scan.falsePositives.empty")).toBeInTheDocument();
  });

  it("renders each report's title", () => {
    render(<FalsePositivesList reports={[makeReport(), makeReport({ id: "fp-2", title: "Hardcoded password" })]} />);
    expect(screen.getByText("SQL Injection via template literal")).toBeInTheDocument();
    expect(screen.getByText("Hardcoded password")).toBeInTheDocument();
  });

  it("renders the user's reason", () => {
    render(<FalsePositivesList reports={[makeReport()]} />);
    expect(screen.getByText("This is a test helper, not production code.")).toBeInTheDocument();
  });

  it("shows the PENDING status badge", () => {
    render(<FalsePositivesList reports={[makeReport({ status: "PENDING" })]} />);
    expect(screen.getByText("scan.falsePositives.statusPENDING")).toBeInTheDocument();
  });

  it("shows the APPROVED status badge", () => {
    render(<FalsePositivesList reports={[makeReport({ status: "APPROVED" })]} />);
    expect(screen.getByText("scan.falsePositives.statusAPPROVED")).toBeInTheDocument();
  });

  it("shows the REJECTED status badge", () => {
    render(<FalsePositivesList reports={[makeReport({ status: "REJECTED" })]} />);
    expect(screen.getByText("scan.falsePositives.statusREJECTED")).toBeInTheDocument();
  });

  it("shows admin note when present", () => {
    render(<FalsePositivesList reports={[makeReport({ adminNote: "Insufficient justification." })]} />);
    expect(screen.getByText("Insufficient justification.")).toBeInTheDocument();
  });

  it("does not render admin note section when absent", () => {
    render(<FalsePositivesList reports={[makeReport({ adminNote: null })]} />);
    expect(screen.queryByText("scan.falsePositives.adminNote")).not.toBeInTheDocument();
  });
});
