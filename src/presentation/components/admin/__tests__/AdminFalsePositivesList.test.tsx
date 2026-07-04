import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminFalsePositivesList } from "../AdminFalsePositivesList";
import type { FalsePositiveReport } from "@/domain/entities/FalsePositiveReport";

const now = new Date("2025-01-15T10:00:00Z");

function makeReport(overrides: Partial<FalsePositiveReport & { projectName?: string; reporterEmail?: string }> = {}) {
  return {
    id: "fp-1",
    projectId: "proj-1",
    reportedById: "user-1",
    category: "A05_INJECTION" as const,
    title: "SQL Injection via template literal",
    filePath: "src/db.ts",
    evidence: "src/db.ts:42 — query snippet",
    reason: "Test helper, not production code.",
    status: "PENDING" as const,
    reviewedById: null,
    reviewedAt: null,
    adminNote: null,
    createdAt: now,
    updatedAt: now,
    projectName: "My Site",
    reporterEmail: "user@example.com",
    ...overrides,
  };
}

describe("AdminFalsePositivesList", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it("shows 'No pending reports' when all reports are reviewed", () => {
    render(<AdminFalsePositivesList reports={[makeReport({ status: "APPROVED" })]} />);
    expect(screen.getByText(/No pending reports/i)).toBeInTheDocument();
  });

  it("renders the report title in the pending section", () => {
    render(<AdminFalsePositivesList reports={[makeReport()]} />);
    expect(screen.getByText("SQL Injection via template literal")).toBeInTheDocument();
  });

  it("shows project name and reporter email when provided", () => {
    render(<AdminFalsePositivesList reports={[makeReport()]} />);
    expect(screen.getByText(/My Site/)).toBeInTheDocument();
    expect(screen.getByText(/user@example\.com/)).toBeInTheDocument();
  });

  it("shows user reason", () => {
    render(<AdminFalsePositivesList reports={[makeReport()]} />);
    expect(screen.getByText("Test helper, not production code.")).toBeInTheDocument();
  });

  it("shows both Approve and Reject buttons for a PENDING report", () => {
    render(<AdminFalsePositivesList reports={[makeReport({ status: "PENDING" })]} />);
    expect(screen.getByRole("button", { name: /approve/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reject/i })).toBeInTheDocument();
  });

  it("hides the Approve button for an already-APPROVED report", () => {
    render(<AdminFalsePositivesList reports={[makeReport({ status: "APPROVED" })]} />);
    expect(screen.queryByRole("button", { name: /approve/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reject/i })).toBeInTheDocument();
  });

  it("hides the Reject button for an already-REJECTED report", () => {
    render(<AdminFalsePositivesList reports={[makeReport({ status: "REJECTED" })]} />);
    expect(screen.getByRole("button", { name: /approve/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /reject/i })).not.toBeInTheDocument();
  });

  it("calls PATCH with APPROVED when the Approve button is clicked", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));

    render(<AdminFalsePositivesList reports={[makeReport()]} />);
    await userEvent.click(screen.getByRole("button", { name: /approve/i }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/admin/false-positives/fp-1",
        expect.objectContaining({
          method: "PATCH",
          body: expect.stringContaining('"APPROVED"'),
        })
      )
    );
  });

  it("calls PATCH with REJECTED when the Reject button is clicked", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));

    render(<AdminFalsePositivesList reports={[makeReport()]} />);
    await userEvent.click(screen.getByRole("button", { name: /reject/i }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/admin/false-positives/fp-1",
        expect.objectContaining({
          method: "PATCH",
          body: expect.stringContaining('"REJECTED"'),
        })
      )
    );
  });

  it("includes adminNote in the PATCH body when note is filled in", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));

    render(<AdminFalsePositivesList reports={[makeReport()]} />);
    await userEvent.type(screen.getByPlaceholderText(/Optional note/i), "Insufficient evidence.");
    await userEvent.click(screen.getByRole("button", { name: /reject/i }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining("Insufficient evidence."),
        })
      )
    );
  });

  it("separates pending and reviewed sections", () => {
    render(
      <AdminFalsePositivesList
        reports={[
          makeReport({ id: "fp-1", status: "PENDING" }),
          makeReport({ id: "fp-2", status: "APPROVED", title: "Approved finding" }),
        ]}
      />
    );
    expect(screen.getByText(/Pending review/)).toBeInTheDocument();
    expect(screen.getByText(/Reviewed/)).toBeInTheDocument();
    expect(screen.getByText("Approved finding")).toBeInTheDocument();
  });

  it("shows admin note on a reviewed report", () => {
    render(
      <AdminFalsePositivesList
        reports={[makeReport({ status: "REJECTED", adminNote: "Not a real false positive." })]}
      />
    );
    expect(screen.getByText("Not a real false positive.")).toBeInTheDocument();
  });
});
