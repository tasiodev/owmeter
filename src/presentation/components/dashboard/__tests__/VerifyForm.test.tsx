import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VerifyForm } from "../VerifyForm";

const mockPush = vi.fn();
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/",
}));

describe("VerifyForm", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it("renders a verify button", () => {
    render(<VerifyForm websiteId="site-1" method="META_TAG" />);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("calls the verify API with the correct websiteId and method", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    );

    render(<VerifyForm websiteId="site-1" method="DNS_TXT" />);
    await userEvent.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/websites/site-1/verify",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ method: "DNS_TXT" }),
        })
      );
    });
  });

  it("navigates to scan page on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    );

    render(<VerifyForm websiteId="site-42" method="FILE" />);
    await userEvent.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(
        "/dashboard/websites/site-42",
        expect.anything()
      );
    });
  });

  it("shows error message on API failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "VERIFY_FAILED" }),
      })
    );

    render(<VerifyForm websiteId="site-1" method="META_TAG" />);
    await userEvent.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(screen.getByText("verify.failed")).toBeInTheDocument();
    });
  });
});
