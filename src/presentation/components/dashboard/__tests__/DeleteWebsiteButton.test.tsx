import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DeleteWebsiteButton } from "../DeleteWebsiteButton";

const mockPush = vi.fn();
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/",
}));

// Translation mock (from setup.ts) returns "namespace.key"
const t = {
  deleteSite: "site.deleteSite",
  deleteConfirm: "site.deleteConfirm",
  deleteYes: "site.deleteYes",
  deleteNo: "site.deleteNo",
  deleting: "site.deleting",
  deleteError: "site.deleteError",
};

describe("DeleteWebsiteButton", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it("renders the delete button in its initial state", () => {
    render(<DeleteWebsiteButton websiteId="site-1" />);
    expect(screen.getByRole("button", { name: t.deleteSite })).toBeInTheDocument();
  });

  it("shows confirmation UI when the delete button is clicked", async () => {
    render(<DeleteWebsiteButton websiteId="site-1" />);
    await userEvent.click(screen.getByRole("button", { name: t.deleteSite }));

    expect(screen.getByRole("button", { name: t.deleteYes })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t.deleteNo })).toBeInTheDocument();
    expect(screen.getByText(t.deleteConfirm)).toBeInTheDocument();
  });

  it("returns to initial state when Cancel is clicked", async () => {
    render(<DeleteWebsiteButton websiteId="site-1" />);
    await userEvent.click(screen.getByRole("button", { name: t.deleteSite }));
    await userEvent.click(screen.getByRole("button", { name: t.deleteNo }));

    expect(screen.getByRole("button", { name: t.deleteSite })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t.deleteYes })).not.toBeInTheDocument();
  });

  it("calls DELETE /api/websites/[id] when confirmed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
    );

    render(<DeleteWebsiteButton websiteId="site-42" />);
    await userEvent.click(screen.getByRole("button", { name: t.deleteSite }));
    await userEvent.click(screen.getByRole("button", { name: t.deleteYes }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/websites/site-42",
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });

  it("redirects to /dashboard after successful deletion", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
    );

    render(<DeleteWebsiteButton websiteId="site-1" />);
    await userEvent.click(screen.getByRole("button", { name: t.deleteSite }));
    await userEvent.click(screen.getByRole("button", { name: t.deleteYes }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/dashboard"));
  });

  it("shows API error in confirmation context and does not redirect", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Internal server error" }),
      })
    );

    render(<DeleteWebsiteButton websiteId="site-1" />);
    await userEvent.click(screen.getByRole("button", { name: t.deleteSite }));
    await userEvent.click(screen.getByRole("button", { name: t.deleteYes }));

    await waitFor(() => {
      expect(screen.getByText("Internal server error")).toBeInTheDocument();
    });
    // Stays in confirmation state so user can retry or cancel
    expect(screen.getByRole("button", { name: t.deleteYes })).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("shows fallback error when API returns no message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) })
    );

    render(<DeleteWebsiteButton websiteId="site-1" />);
    await userEvent.click(screen.getByRole("button", { name: t.deleteSite }));
    await userEvent.click(screen.getByRole("button", { name: t.deleteYes }));

    await waitFor(() => {
      expect(screen.getByText(t.deleteError)).toBeInTheDocument();
    });
  });

  it("disables both buttons while the request is in flight", async () => {
    let resolve: (v: unknown) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockReturnValue(new Promise((r) => { resolve = r; }))
    );

    render(<DeleteWebsiteButton websiteId="site-1" />);
    await userEvent.click(screen.getByRole("button", { name: t.deleteSite }));
    await userEvent.click(screen.getByRole("button", { name: t.deleteYes }));

    expect(screen.getByRole("button", { name: t.deleting })).toBeDisabled();
    expect(screen.getByRole("button", { name: t.deleteNo })).toBeDisabled();

    resolve!({ ok: true, json: async () => ({ ok: true }) });
  });
});
