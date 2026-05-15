import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VerifyDomainForm } from "../VerifyDomainForm";

const mockPush = vi.fn();
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/",
}));

describe("VerifyDomainForm", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it("renders a verify button", () => {
    render(<VerifyDomainForm projectId="proj-1" method="META_TAG" />);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("calls the verify API with the correct projectId and method", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    );

    render(<VerifyDomainForm projectId="proj-1" method="DNS_TXT" />);
    await userEvent.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/projects/proj-1/verify-domain",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ method: "DNS_TXT" }),
        })
      );
    });
  });

  it("navigates to project page on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    );

    render(<VerifyDomainForm projectId="proj-42" method="FILE" />);
    await userEvent.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(
        "/dashboard/projects/proj-42",
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

    render(<VerifyDomainForm projectId="proj-1" method="META_TAG" />);
    await userEvent.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(screen.getByText("verify.failed")).toBeInTheDocument();
    });
  });
});
