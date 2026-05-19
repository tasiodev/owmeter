import type { Metadata } from "next";
import { headers } from "next/headers";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { auth, signOut } from "@/infrastructure/auth/auth";
import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "@/presentation/components/ui/LanguageSwitcher";
import { Logo } from "@/presentation/components/ui/Logo";
import { PrismaScanRepository } from "@/infrastructure/database/repositories/PrismaScanRepository";
import { OWASP_CATEGORIES, evaluationLevel } from "@/domain/value-objects/OWASPCategory";
import type { OWASPCategoryId, ScanMode } from "@/domain/value-objects/OWASPCategory";
import { ShowcaseCarousel } from "@/presentation/components/home/ShowcaseCarousel";
import type { CardData } from "@/presentation/components/home/ShowcaseCarousel";
import { Footer } from "@/presentation/components/ui/Footer";
import { BetaBadge } from "@/presentation/components/ui/BetaBadge";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://owmeter.dev";

const OWASP_ITEMS = [
  { id: "A01", name: "Broken Access Control", desc: "Auth guards, CORS policies, path traversal, IDOR" },
  { id: "A02", name: "Cryptographic Failures", desc: "HTTPS, HSTS, TLS config, Secure cookie flag, weak algorithms" },
  { id: "A03", name: "Injection", desc: "SQL, XSS, and command injection via OWASP ZAP active scan" },
  { id: "A04", name: "Insecure Design", desc: "Input validation and security patterns in source code" },
  { id: "A05", name: "Security Misconfiguration", desc: "HTTP headers, CSP, X-Frame-Options, server info leakage" },
  { id: "A06", name: "Vulnerable Components", desc: "Known CVEs and outdated dependency detection" },
  { id: "A07", name: "Auth Failures", desc: "Cookie flags, JWT signing, password hashing, brute-force protection" },
  { id: "A08", name: "Data Integrity Failures", desc: "Unsafe deserialization and supply chain patterns in code" },
  { id: "A09", name: "Logging Failures", desc: "Logging practices and sensitive data in logs" },
  { id: "A10", name: "SSRF", desc: "Server-side request forgery probes on public endpoints" },
] as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "home" });
  const title = t("metaTitle");
  const description = t("metaDesc");

  return {
    title,
    description,
    alternates: {
      canonical: `${BASE_URL}/${locale}`,
    },
    openGraph: {
      title,
      description,
      url: `${BASE_URL}/${locale}`,
    },
    twitter: {
      title,
      description,
    },
  };
}

function Features() {
  const t = useTranslations("home");
  const githubUrl = process.env.NEXT_PUBLIC_GITHUB_URL ?? "#";
  return (
    <div className="pt-8 text-left space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {(["feature1", "feature2", "feature3"] as const).map((key) => (
          <div key={key} className="rounded-xl border border-gray-800 p-6 space-y-2">
            <h3 className="font-semibold text-gray-100">{t(`${key}Title`)}</h3>
            <p className="text-sm text-gray-400">{t(`${key}Desc`)}</p>
          </div>
        ))}
      </div>
      <a
        href={githubUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-start gap-4 rounded-xl border border-gray-800 hover:border-gray-600 p-6 transition-colors group"
      >
        <svg className="w-5 h-5 fill-white shrink-0 mt-0.5" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
        </svg>
        <div className="flex-1 space-y-1">
          <h3 className="font-semibold text-gray-100">{t("openSourceTitle")}</h3>
          <p className="text-sm text-gray-400">{t("openSourceDesc")}</p>
        </div>
        <span className="text-sm text-emerald-400 group-hover:text-emerald-300 shrink-0 mt-0.5">{t("viewSource")} →</span>
      </a>
    </div>
  );
}

function WhySecurity() {
  const t = useTranslations("home");
  const stats = (["1", "2", "3", "4"] as const).map((n) => ({
    value: t(`whyStat${n}Value`),
    label: t(`whyStat${n}Label`),
  }));

  return (
    <section className="w-full py-16 border-t border-gray-800">
      <div className="max-w-3xl mx-auto px-6">
        <div className="text-center mb-10 space-y-2">
          <h2 className="text-2xl font-bold text-gray-100">{t("whySecurityTitle")}</h2>
          <p className="text-sm text-gray-500 max-w-xl mx-auto">{t("whySecuritySubtitle")}</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {stats.map(({ value, label }) => (
            <div key={value} className="rounded-xl border border-gray-800 p-5 space-y-2 text-center">
              <p className="text-2xl font-bold text-emerald-400">{value}</p>
              <p className="text-xs text-gray-400 leading-relaxed">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const t = useTranslations("home");
  const steps = (["step1", "step2", "step3"] as const).map((key, i) => ({
    num: i + 1,
    title: t(`${key}Title`),
    desc: t(`${key}Desc`),
  }));

  return (
    <section className="w-full py-16 border-t border-gray-800">
      <div className="max-w-3xl mx-auto px-6">
        <div className="text-center mb-10 space-y-2">
          <h2 className="text-2xl font-bold text-gray-100">{t("howItWorksTitle")}</h2>
          <p className="text-sm text-gray-500">{t("howItWorksSubtitle")}</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          {steps.map(({ num, title, desc }) => (
            <div key={num} className="space-y-3">
              <h3 className="font-semibold text-gray-100 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-xs shrink-0">
                  {num}
                </span>
                {title}
              </h3>
              <p className="text-sm text-gray-400">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function OWASPGrid() {
  const t = useTranslations("home");
  return (
    <section className="w-full py-16 border-t border-gray-800">
      <div className="max-w-3xl mx-auto px-6">
        <div className="text-center mb-10 space-y-2">
          <h2 className="text-2xl font-bold text-gray-100">{t("owaspTitle")}</h2>
          <p className="text-sm text-gray-500 max-w-xl mx-auto">{t("owaspSubtitle")}</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {OWASP_ITEMS.map(({ id, name, desc }) => (
            <div key={id} className="flex gap-3 rounded-lg border border-gray-800 p-4">
              <span className="text-xs font-mono text-emerald-400 shrink-0 pt-0.5 w-7">{id}</span>
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-gray-100">{name}</p>
                <p className="text-xs text-gray-500">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const TOTAL_CATEGORIES = Object.keys(OWASP_CATEGORIES).length;

function evaluationStats(scanType: string) {
  const ids = Object.keys(OWASP_CATEGORIES) as OWASPCategoryId[];
  const levels = ids.map((id) => evaluationLevel(id, scanType as ScanMode));
  return {
    evaluated: levels.filter((l) => l !== "none").length,
    partial: levels.filter((l) => l === "partial").length,
  };
}

async function SecureShowcase() {
  const t = await getTranslations("home");
  const ts = await getTranslations("scan");
  const scanRepo = new PrismaScanRepository();
  const sites = await scanRepo.findPublicPerfectScoreScans(20);

  const seen = new Set<string>();
  const unique = sites.filter((s) => {
    if (seen.has(s.url)) return false;
    seen.add(s.url);
    return true;
  });

  const cards: CardData[] = unique.map((site) => {
    const isWebsite = site.projectType === "WEBSITE";
    const href = isWebsite ? `https://${site.url}` : site.url;
    const { evaluated, partial } = evaluationStats(site.scanType);
    const categoriesLabel =
      ts("categoriesEvaluated", { evaluated, total: TOTAL_CATEGORIES }) +
      (partial > 0 ? ts("categoriesPartial", { partial }) : "");
    return { url: site.url, href, isWebsite, categoriesLabel, score: site.score, repoUrl: site.repoUrl, zipSourceLabel: site.zipSource ? t("showcaseZipSource") : undefined, zipSourceTitle: site.zipSource ? t("showcaseZipSourceTitle") : undefined };
  });

  const groups: CardData[][] = [];
  for (let i = 0; i < cards.length; i += 3) {
    groups.push(cards.slice(i, i + 3));
  }

  return (
    <section className="w-full pt-12 pb-6 border-t border-gray-800">
      <div className="max-w-3xl mx-auto px-6 text-center mb-8 space-y-1">
        <h2 className="text-2xl font-bold text-gray-100">{t("showcaseTitle")}</h2>
        <p className="text-sm text-gray-500">{t("showcaseSubtitle")}</p>
      </div>
      {groups.length > 0 ? (
        <ShowcaseCarousel groups={groups} />
      ) : (
        <p className="text-center text-sm text-gray-600 py-4">{t("showcaseEmpty")}</p>
      )}
    </section>
  );
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("home");
  const tc = await getTranslations("common");
  const session = await auth();
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "OWMeter",
    url: BASE_URL,
    description: t("metaDesc"),
    applicationCategory: "SecurityApplication",
    operatingSystem: "Web",
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };

  return (
    <div className="flex flex-col min-h-screen">
      <script
        type="application/ld+json"
        nonce={nonce}
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />

      <header className="border-b border-gray-800 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <Link href="/">
            <Logo variant="topbar" />
          </Link>
          <span className="hidden sm:block">
            <BetaBadge />
          </span>
        </div>
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <LanguageSwitcher />
          {session ? (
            <>
              <span className="hidden sm:block text-sm text-gray-400 truncate max-w-[180px]">{session.user?.email}</span>
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: `/${locale}` });
                }}
              >
                <button
                  type="submit"
                  className="text-sm text-gray-400 hover:text-white transition-colors"
                >
                  {tc("signOut")}
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/login"
              className="text-sm px-3 sm:px-4 py-1.5 rounded-lg border border-emerald-500 text-emerald-400 hover:bg-emerald-500 hover:text-gray-950 font-medium transition-colors"
            >
              {tc("signIn")}
            </Link>
          )}
        </div>
      </header>

      <main className="flex-1">
        <section className="flex flex-col items-center px-6 py-20 text-center">
          <div className="max-w-3xl mx-auto space-y-6">
            <Logo variant="hero" aria-hidden="true" />
            <h1 className="text-3xl font-bold text-white leading-tight">
              {t("headline")}
            </h1>
            <p className="text-lg text-gray-400 max-w-xl mx-auto">{t("description")}</p>
            <div className="flex justify-center">
              {session ? (
                <Link
                  href="/dashboard"
                  className="inline-flex items-center justify-center px-8 py-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-semibold transition-colors"
                >
                  {t("ctaDashboard")}
                </Link>
              ) : (
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center px-8 py-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-semibold transition-colors"
                >
                  {t("ctaStart")}
                </Link>
              )}
            </div>
            <Features />
          </div>
        </section>

        <SecureShowcase />
        <WhySecurity />
        <HowItWorks />
        <OWASPGrid />
      </main>

      <Footer />
    </div>
  );
}
