import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ScanTypeSelector } from "../ScanTypeSelector";

const T = (key: string) => `scan.${key}`;

const mockPush = vi.fn();
const mockRefresh = vi.fn();

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), refresh: mockRefresh }),
  usePathname: () => "/",
}));

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());

describe("ScanTypeSelector — WEBSITE without repo (PASSIVE + FULL with ZIP)", () => {
  it("renders PASSIVE and FULL radio buttons even without verified repo", () => {
    render(
      <ScanTypeSelector projectId="proj-1" projectType="WEBSITE" hasVerifiedRepo={false} />
    );
    expect(screen.getByDisplayValue("PASSIVE")).toBeInTheDocument();
    expect(screen.getByDisplayValue("FULL")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: T("startScan") })).toBeInTheDocument();
  });

  it("posts PASSIVE scan type", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "scan-1" }) })
    );

    render(
      <ScanTypeSelector projectId="proj-99" projectType="WEBSITE" hasVerifiedRepo={false} />
    );
    await userEvent.click(screen.getByRole("button", { name: T("startScan") }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/scans",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ scanType: "PASSIVE", projectId: "proj-99" }),
        })
      );
    });
  });
});

describe("ScanTypeSelector — WEBSITE with repo (PASSIVE + FULL)", () => {
  it("renders radio buttons for PASSIVE and FULL", () => {
    render(
      <ScanTypeSelector projectId="proj-1" projectType="WEBSITE" hasVerifiedRepo={true} />
    );
    expect(screen.getByDisplayValue("PASSIVE")).toBeInTheDocument();
    expect(screen.getByDisplayValue("FULL")).toBeInTheDocument();
  });

  it("posts FULL scan type when FULL is selected", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "scan-1" }) })
    );

    render(
      <ScanTypeSelector projectId="proj-1" projectType="WEBSITE" hasVerifiedRepo={true} />
    );
    await userEvent.click(screen.getByDisplayValue("FULL"));
    await userEvent.click(screen.getByRole("button", { name: T("startScan") }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/scans",
        expect.objectContaining({
          body: JSON.stringify({ scanType: "FULL", projectId: "proj-1" }),
        })
      );
    });
  });

  it("redirects after successful scan creation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "scan-1" }) })
    );

    render(
      <ScanTypeSelector
        projectId="proj-1"
        projectType="WEBSITE"
        hasVerifiedRepo={false}
        redirectTo="/dashboard/projects/proj-1"
      />
    );
    await userEvent.click(screen.getByRole("button", { name: T("startScan") }));

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith("/dashboard/projects/proj-1")
    );
  });
});

describe("ScanTypeSelector — CODE_REPO (CODE only)", () => {
  it("renders only the start button for CODE_REPO", () => {
    render(
      <ScanTypeSelector projectId="proj-1" projectType="CODE_REPO" hasVerifiedRepo={true} />
    );
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: T("startScan") })).toBeInTheDocument();
  });

  it("posts CODE scan type", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "scan-1" }) })
    );

    render(
      <ScanTypeSelector projectId="proj-99" projectType="CODE_REPO" hasVerifiedRepo={true} />
    );
    await userEvent.click(screen.getByRole("button", { name: T("startScan") }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/scans",
        expect.objectContaining({
          body: JSON.stringify({ scanType: "CODE", projectId: "proj-99" }),
        })
      );
    });
  });
});

describe("ScanTypeSelector — error states", () => {
  it("shows error on API failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ message: "Something went wrong" }),
      })
    );

    render(
      <ScanTypeSelector projectId="proj-1" projectType="WEBSITE" hasVerifiedRepo={false} />
    );
    await userEvent.click(screen.getByRole("button", { name: T("startScan") }));

    await waitFor(() => {
      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    });
  });

  it("disables submit button while loading", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => new Promise(() => {}))
    );

    render(
      <ScanTypeSelector projectId="proj-1" projectType="WEBSITE" hasVerifiedRepo={false} />
    );
    await userEvent.click(screen.getByRole("button", { name: T("startScan") }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: T("starting") })).toBeDisabled();
    });
  });
});
