import type { Metadata } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://owmeter.dev";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "OWMeter — Free OWASP Top 10 Security Scanner",
    template: "%s | OWMeter",
  },
  description:
    "Free, open-source OWASP Top 10 scanner for websites and code repositories. Get a security score out of 100 with detailed per-category findings.",
  keywords: [
    "OWASP Top 10",
    "website security scanner",
    "web security audit",
    "security score",
    "vulnerability scanner",
    "free security scan",
    "open source security",
    "OWASP scanner",
  ],
  authors: [{ name: "OWMeter" }],
  creator: "OWMeter",
  openGraph: {
    type: "website",
    siteName: "OWMeter",
  },
  twitter: {
    card: "summary_large_image",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  other: {
    "owmeter-verify": "cmpa3jtit000101o6uh1dr99h",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
