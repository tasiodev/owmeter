import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { auth, signOut } from "@/infrastructure/auth/auth";
import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "@/presentation/components/ui/LanguageSwitcher";
import { PrismaScanRepository } from "@/infrastructure/database/repositories/PrismaScanRepository";
import { OWASP_CATEGORIES, evaluationLevel } from "@/domain/value-objects/OWASPCategory";
import type { OWASPCategoryId, ScanMode } from "@/domain/value-objects/OWASPCategory";
import { ShowcaseCarousel } from "@/presentation/components/home/ShowcaseCarousel";
import type { CardData } from "@/presentation/components/home/ShowcaseCarousel";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "home" });
  return { title: `OwaspChecker — ${t("headline")}` };
}

function Features() {
  const t = useTranslations("home");
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-8 text-left">
      {(["feature1", "feature2", "feature3"] as const).map((key) => (
        <div key={key} className="rounded-xl border border-gray-800 p-6 space-y-2">
          <h3 className="font-semibold text-gray-100">{t(`${key}Title`)}</h3>
          <p className="text-sm text-gray-400">{t(`${key}Desc`)}</p>
        </div>
      ))}
    </div>
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
    return { url: site.url, href, isWebsite, categoriesLabel };
  });

  const groups: CardData[][] = [];
  for (let i = 0; i < cards.length; i += 3) {
    groups.push(cards.slice(i, i + 3));
  }

  return (
    <section className="w-full pt-12 pb-6 border-t border-gray-800">
      <div className="max-w-3xl mx-auto px-6 text-center mb-8 space-y-1">
        <h2 className="text-base font-semibold text-gray-100">{t("showcaseTitle")}</h2>
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

  return (
    <div className="flex flex-col min-h-screen">
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold">
          <span className="text-emerald-400">OWASP</span>Checker
        </Link>
        <div className="flex items-center gap-4">
          <LanguageSwitcher />
          {session && (
            <>
              <span className="text-sm text-gray-400">{session.user?.email}</span>
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
          )}
        </div>
      </header>

      <main className="flex flex-col items-center justify-center flex-1 px-6 py-16 text-center">
        <div className="max-w-3xl mx-auto space-y-8">
          <div className="space-y-4">
            <h1 className="text-5xl font-bold tracking-tight">
              <span className="text-emerald-400">OWASP</span>Checker
            </h1>
            <p className="text-xl text-gray-400 max-w-xl mx-auto">{t("description")}</p>
          </div>

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
      </main>

      <SecureShowcase />
    </div>
  );
}
