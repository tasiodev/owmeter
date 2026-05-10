import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AddWebsiteForm } from "../AddWebsiteForm";

// useRouter().refresh is mocked globally in setup.ts
const mockRefresh = vi.fn();
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: mockRefresh }),
  usePathname: () => "/",
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

function renderForm() {
  return render(<AddWebsiteForm />);
}

describe("AddWebsiteForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "site-1" }) })
    );
  });

  afterEach(() => vi.unstubAllGlobals());

  it("renders the domain input and submit button", () => {
    renderForm();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("submits the form with the domain lowercased", async () => {
    renderForm();
    const user = userEvent.setup();

    // The component lowercases via .toLowerCase() in handleSubmit
    await user.type(screen.getByRole("textbox"), "Example.COM");
    await user.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/websites",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ domain: "example.com" }),
        })
      );
    });
  });

  it("calls router.refresh() on success", async () => {
    renderForm();
    const user = userEvent.setup();

    await user.type(screen.getByRole("textbox"), "example.com");
    await user.click(screen.getByRole("button"));

    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
  });

  it("shows an error message on API failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Domain already registered" }),
      })
    );

    renderForm();
    const user = userEvent.setup();

    await user.type(screen.getByRole("textbox"), "taken.com");
    await user.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(screen.getByText("Domain already registered")).toBeInTheDocument();
    });
  });

  it("clears the input after successful submission", async () => {
    renderForm();
    const user = userEvent.setup();
    const input = screen.getByRole("textbox");

    await user.type(input, "example.com");
    await user.click(screen.getByRole("button"));

    await waitFor(() => expect(input).toHaveValue(""));
  });
});
