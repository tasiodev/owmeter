import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DeleteProjectButton } from "../DeleteProjectButton";

const mockPush = vi.fn();
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/",
}));

const t = {
  deleteProject: "site.deleteProject",
  deleteConfirm: "site.deleteConfirm",
  deleteYes: "site.deleteYes",
  deleteNo: "site.deleteNo",
  deleting: "site.deleting",
  deleteError: "site.deleteError",
};

describe("DeleteProjectButton", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it("renders the delete button in its initial state", () => {
    render(<DeleteProjectButton projectId="proj-1" />);
    expect(screen.getByRole("button", { name: t.deleteProject })).toBeInTheDocument();
  });

  it("shows confirmation UI when the delete button is clicked", async () => {
    render(<DeleteProjectButton projectId="proj-1" />);
    await userEvent.click(screen.getByRole("button", { name: t.deleteProject }));

    expect(screen.getByRole("button", { name: t.deleteYes })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t.deleteNo })).toBeInTheDocument();
    expect(screen.getByText(t.deleteConfirm)).toBeInTheDocument();
  });

  it("returns to initial state when Cancel is clicked", async () => {
    render(<DeleteProjectButton projectId="proj-1" />);
    await userEvent.click(screen.getByRole("button", { name: t.deleteProject }));
    await userEvent.click(screen.getByRole("button", { name: t.deleteNo }));

    expect(screen.getByRole("button", { name: t.deleteProject })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t.deleteYes })).not.toBeInTheDocument();
  });

  it("calls DELETE /api/projects/[id] when confirmed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
    );

    render(<DeleteProjectButton projectId="proj-42" />);
    await userEvent.click(screen.getByRole("button", { name: t.deleteProject }));
    await userEvent.click(screen.getByRole("button", { name: t.deleteYes }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/projects/proj-42",
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });

  it("redirects to /dashboard after successful deletion", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
    );

    render(<DeleteProjectButton projectId="proj-1" />);
    await userEvent.click(screen.getByRole("button", { name: t.deleteProject }));
    await userEvent.click(screen.getByRole("button", { name: t.deleteYes }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/dashboard"));
  });

  it("shows error and does not redirect on API failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "server error" }) })
    );

    render(<DeleteProjectButton projectId="proj-1" />);
    await userEvent.click(screen.getByRole("button", { name: t.deleteProject }));
    await userEvent.click(screen.getByRole("button", { name: t.deleteYes }));

    await waitFor(() => {
      expect(screen.getByText(t.deleteError)).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: t.deleteYes })).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("disables both buttons while the request is in flight", async () => {
    let resolve: (v: unknown) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockReturnValue(new Promise((r) => { resolve = r; }))
    );

    render(<DeleteProjectButton projectId="proj-1" />);
    await userEvent.click(screen.getByRole("button", { name: t.deleteProject }));
    await userEvent.click(screen.getByRole("button", { name: t.deleteYes }));

    expect(screen.getByRole("button", { name: t.deleting })).toBeDisabled();
    expect(screen.getByRole("button", { name: t.deleteNo })).toBeDisabled();

    resolve!({ ok: true, json: async () => ({ ok: true }) });
  });
});
