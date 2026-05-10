import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { auth } from "@/infrastructure/auth/auth";
import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "@/presentation/components/ui/LanguageSwitcher";

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

export default async function HomePage() {
  const t = await getTranslations("home");
  const tc = await getTranslations("common");
  const session = await auth();

  return (
    <div className="flex flex-col min-h-screen">
      <header className="flex justify-end px-6 py-4">
        <LanguageSwitcher />
      </header>
      <main className="flex flex-col items-center justify-center flex-1 px-6 py-16 text-center">
        <div className="max-w-3xl mx-auto space-y-8">
          <div className="space-y-4">
            <h1 className="text-5xl font-bold tracking-tight">
              <span className="text-emerald-400">OWASP</span>Checker
            </h1>
            <p className="text-xl text-gray-400 max-w-xl mx-auto">{t("description")}</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
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
            <Link
              href="/ranking"
              className="inline-flex items-center justify-center px-8 py-3 rounded-lg border border-gray-700 hover:border-gray-500 text-gray-300 hover:text-white transition-colors"
            >
              {tc("viewRankings")}
            </Link>
          </div>

          <Features />
        </div>
      </main>
    </div>
  );
}
