import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ScanTypeSelector } from "../ScanTypeSelector";

// The next-intl mock returns "namespace.key", so t("basicTitle") → "scan.basicTitle"
const T = (key: string) => `scan.${key}`;

const mockPush = vi.fn();
const mockRefresh = vi.fn();

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), refresh: mockRefresh }),
  usePathname: () => "/",
}));

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());

describe("ScanTypeSelector — rendering", () => {
  it("renders Basic and Complete scan options", () => {
    render(<ScanTypeSelector websiteId="site-1" />);
    expect(screen.getByText(T("basicTitle"))).toBeInTheDocument();
    expect(screen.getByText(T("completeTitle"))).toBeInTheDocument();
  });

  it("does not show PrivacyNotice by default (Basic selected)", () => {
    render(<ScanTypeSelector websiteId="site-1" />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows PrivacyNotice when Complete is selected", async () => {
    render(<ScanTypeSelector websiteId="site-1" />);
    await userEvent.click(screen.getByDisplayValue("COMPLETE"));
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("shows file input when Complete + ZIP is selected", async () => {
    render(<ScanTypeSelector websiteId="site-1" />);
    await userEvent.click(screen.getByDisplayValue("COMPLETE"));
    expect(document.querySelector('input[type="file"]')).toBeInTheDocument();
  });

  it("shows GitHub URL input when GitHub tab is clicked", async () => {
    render(<ScanTypeSelector websiteId="site-1" />);
    await userEvent.click(screen.getByDisplayValue("COMPLETE"));
    await userEvent.click(screen.getByText(T("githubUrl")));
    expect(screen.getByPlaceholderText(/github\.com/i)).toBeInTheDocument();
  });
});

describe("ScanTypeSelector — BASIC scan submission", () => {
  it("posts JSON with scanType: BASIC for basic scan", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "scan-1" }) })
    );

    render(<ScanTypeSelector websiteId="site-99" />);
    await userEvent.click(screen.getByRole("button", { name: T("startScan") }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/scans",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({ "Content-Type": "application/json" }),
          body: JSON.stringify({ scanType: "BASIC", websiteId: "site-99" }),
        })
      );
    });
  });

  it("redirects to redirectTo after successful basic scan creation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "scan-1" }) })
    );

    render(<ScanTypeSelector websiteId="site-1" redirectTo="/dashboard/websites/site-1" />);
    await userEvent.click(screen.getByRole("button", { name: T("startScan") }));

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith("/dashboard/websites/site-1")
    );
  });
});

describe("ScanTypeSelector — COMPLETE with ZIP", () => {
  it("shows zipRequired error when submitting without a file", async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);

    render(<ScanTypeSelector websiteId="site-1" />);
    await userEvent.click(screen.getByDisplayValue("COMPLETE"));
    await userEvent.click(screen.getByRole("button", { name: T("startScan") }));

    expect(screen.getByText(T("zipRequired"))).toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("shows zipTooLarge error when file exceeds 50 MB", async () => {
    render(<ScanTypeSelector websiteId="site-1" />);
    await userEvent.click(screen.getByDisplayValue("COMPLETE"));

    const bigFile = new File([new Uint8Array(50 * 1024 * 1024 + 1)], "big.zip", {
      type: "application/zip",
    });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(input, bigFile);
    await userEvent.click(screen.getByRole("button", { name: T("startScan") }));

    expect(screen.getByText(T("zipTooLarge"))).toBeInTheDocument();
  });

  it("shows selected filename after ZIP file selection", async () => {
    render(<ScanTypeSelector websiteId="site-1" />);
    await userEvent.click(screen.getByDisplayValue("COMPLETE"));

    const file = new File(["PK"], "project.zip", { type: "application/zip" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(input, file);

    expect(screen.getByText(/project\.zip/i)).toBeInTheDocument();
  });

  it("posts FormData with zipFile for complete ZIP scan", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "scan-1" }) })
    );

    render(<ScanTypeSelector websiteId="site-1" />);
    await userEvent.click(screen.getByDisplayValue("COMPLETE"));

    const file = new File(["PK"], "app.zip", { type: "application/zip" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(input, file);
    await userEvent.click(screen.getByRole("button", { name: T("startScan") }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/scans",
        expect.objectContaining({ method: "POST", body: expect.any(FormData) })
      );
    });
  });
});

describe("ScanTypeSelector — COMPLETE with GitHub URL", () => {
  it("posts JSON with githubUrl for complete GitHub scan", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "scan-1" }) })
    );

    render(<ScanTypeSelector websiteId="site-1" />);
    await userEvent.click(screen.getByDisplayValue("COMPLETE"));
    await userEvent.click(screen.getByText(T("githubUrl")));
    await userEvent.type(
      screen.getByPlaceholderText(/github\.com/i),
      "https://github.com/owner/repo"
    );
    await userEvent.click(screen.getByRole("button", { name: T("startScan") }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/scans",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            scanType: "COMPLETE",
            websiteId: "site-1",
            githubUrl: "https://github.com/owner/repo",
          }),
        })
      );
    });
  });
});

describe("ScanTypeSelector — error states", () => {
  it("shows network error for unknown API failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Website ownership not verified" }),
      })
    );

    render(<ScanTypeSelector websiteId="site-1" />);
    await userEvent.click(screen.getByRole("button", { name: T("startScan") }));

    await waitFor(() => {
      expect(screen.getByText(T("networkError"))).toBeInTheDocument();
    });
  });

  it("shows translated verification error when VERIFICATION_FAILED is returned", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "VERIFICATION_FAILED" }),
      })
    );

    render(<ScanTypeSelector websiteId="site-1" />);
    await userEvent.click(screen.getByRole("button", { name: T("startScan") }));

    await waitFor(() => {
      expect(screen.getByText(T("verificationFailed"))).toBeInTheDocument();
    });
  });

  it("disables submit button while loading", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => new Promise(() => {})) // never resolves
    );

    render(<ScanTypeSelector websiteId="site-1" />);
    await userEvent.click(screen.getByRole("button", { name: T("startScan") }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: T("starting") })).toBeDisabled();
    });
  });
});
