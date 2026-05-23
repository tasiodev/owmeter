import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AddProjectForm } from "../AddProjectForm";

const mockPush = vi.fn();
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/",
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

function renderForm() {
  return render(<AddProjectForm />);
}

describe("AddProjectForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "proj-1" }) })
    );
  });

  afterEach(() => vi.unstubAllGlobals());

  it("renders type selection buttons initially", () => {
    renderForm();
    expect(screen.getByText("dashboard.typeWebsite")).toBeInTheDocument();
    expect(screen.getByText("dashboard.typeCodeRepo")).toBeInTheDocument();
  });

  it("shows name and domain fields after selecting Website type", async () => {
    renderForm();
    const user = userEvent.setup();

    await user.click(screen.getByText("dashboard.typeWebsite"));

    expect(screen.getByPlaceholderText("dashboard.projectNamePlaceholder")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("dashboard.domainPlaceholder")).toBeInTheDocument();
  });

  it("shows only name field after selecting Code Repo type", async () => {
    renderForm();
    const user = userEvent.setup();

    await user.click(screen.getByText("dashboard.typeCodeRepo"));

    expect(screen.getByPlaceholderText("dashboard.projectNamePlaceholder")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("dashboard.domainPlaceholder")).not.toBeInTheDocument();
  });

  it("submits WEBSITE project with name and lowercased domain", async () => {
    renderForm();
    const user = userEvent.setup();

    await user.click(screen.getByText("dashboard.typeWebsite"));
    await user.type(screen.getByPlaceholderText("dashboard.projectNamePlaceholder"), "My Site");
    await user.type(screen.getByPlaceholderText("dashboard.domainPlaceholder"), "Example.COM");
    await user.click(screen.getByRole("button", { name: /dashboard.addProject/i }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/projects",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ type: "WEBSITE", name: "My Site", domain: "example.com", isPublic: true }),
        })
      );
    });
  });

  it("submits CODE_REPO project with only name", async () => {
    renderForm();
    const user = userEvent.setup();

    await user.click(screen.getByText("dashboard.typeCodeRepo"));
    await user.type(screen.getByPlaceholderText("dashboard.projectNamePlaceholder"), "My Lib");
    await user.click(screen.getByRole("button", { name: /dashboard.addProject/i }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/projects",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ type: "CODE_REPO", name: "My Lib", isPublic: true }),
        })
      );
    });
  });

  it("redirects to the new project page on success", async () => {
    renderForm();
    const user = userEvent.setup();

    await user.click(screen.getByText("dashboard.typeCodeRepo"));
    await user.type(screen.getByPlaceholderText("dashboard.projectNamePlaceholder"), "My Lib");
    await user.click(screen.getByRole("button", { name: /dashboard.addProject/i }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/dashboard/projects/proj-1"));
  });

  it("shows domain error on DOMAIN_ALREADY_IN_LIST response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "DOMAIN_ALREADY_IN_LIST" }),
      })
    );

    renderForm();
    const user = userEvent.setup();

    await user.click(screen.getByText("dashboard.typeWebsite"));
    await user.type(screen.getByPlaceholderText("dashboard.projectNamePlaceholder"), "My Site");
    await user.type(screen.getByPlaceholderText("dashboard.domainPlaceholder"), "taken.com");
    await user.click(screen.getByRole("button", { name: /dashboard.addProject/i }));

    await waitFor(() => {
      expect(screen.getByText("dashboard.domainAlreadyInList")).toBeInTheDocument();
    });
  });
});
