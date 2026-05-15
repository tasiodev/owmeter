import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StartScanButton } from "../StartScanButton";

const mockRefresh = vi.fn();
const mockPush = vi.fn();
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), refresh: mockRefresh }),
  usePathname: () => "/",
}));

describe("StartScanButton", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it("renders a Start Scan button", () => {
    render(<StartScanButton projectId="proj-1" />);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("posts to /api/scans with projectId and PASSIVE scanType", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "scan-1" }) })
    );

    render(<StartScanButton projectId="proj-99" />);
    await userEvent.click(screen.getByRole("button"));

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

  it("calls router.refresh() after successful scan creation when no redirectTo", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "scan-1" }) })
    );

    render(<StartScanButton projectId="proj-1" />);
    await userEvent.click(screen.getByRole("button"));

    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("redirects to redirectTo path after successful scan creation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "scan-1" }) })
    );

    render(<StartScanButton projectId="proj-1" redirectTo="/dashboard/projects/proj-1" />);
    await userEvent.click(screen.getByRole("button"));

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith("/dashboard/projects/proj-1")
    );
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("shows not-verified error on NOT_VERIFIED response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "NOT_VERIFIED" }),
      })
    );

    render(<StartScanButton projectId="proj-1" />);
    await userEvent.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(screen.getByText("scan.notVerified")).toBeInTheDocument();
    });
  });
});
