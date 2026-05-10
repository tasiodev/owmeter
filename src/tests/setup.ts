import "@testing-library/jest-dom";
import { vi } from "vitest";

// next-intl mock for components that use useTranslations
vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string, values?: Record<string, unknown>) => {
    const full = `${namespace}.${key}`;
    if (!values) return full;
    return Object.entries(values).reduce(
      (s, [k, v]) => s.replace(`{${k}}`, String(v)),
      full
    );
  },
  useLocale: () => "en",
  getTranslations: async () => (key: string) => key,
  hasLocale: (locales: string[], locale: string) => locales.includes(locale),
  NextIntlClientProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// next-intl server mock
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) => key,
  getMessages: async () => ({}),
}));

// i18n navigation mock
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const React = require("react");
    return React.createElement("a", { href, ...props }, children);
  },
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/",
  redirect: vi.fn(),
}));

// Next.js navigation mock
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  notFound: vi.fn(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));
