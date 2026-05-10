import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LanguageSwitcher } from "../LanguageSwitcher";

const mockReplace = vi.fn();

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: mockReplace, refresh: vi.fn() }),
  usePathname: () => "/dashboard",
}));

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}));

describe("LanguageSwitcher", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders EN and ES buttons", () => {
    render(<LanguageSwitcher />);
    expect(screen.getByRole("button", { name: "EN" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ES" })).toBeInTheDocument();
  });

  it("marks the current locale button as active (aria-current)", () => {
    render(<LanguageSwitcher />);
    expect(screen.getByRole("button", { name: "EN" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("button", { name: "ES" })).not.toHaveAttribute("aria-current");
  });

  it("calls router.replace with ES locale when ES button is clicked", async () => {
    render(<LanguageSwitcher />);
    await userEvent.click(screen.getByRole("button", { name: "ES" }));
    expect(mockReplace).toHaveBeenCalledWith("/dashboard", { locale: "es" });
  });
});
