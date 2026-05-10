import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { PrismaScanRepository } from "@/infrastructure/database/repositories/PrismaScanRepository";
import { LanguageSwitcher } from "@/presentation/components/ui/LanguageSwitcher";

export const revalidate = 300;

function scoreColor(score: number, maxScore: number) {
  const pct = maxScore > 0 ? (score / maxScore) * 100 : 0;
  if (pct >= 80) return "text-emerald-400";
  if (pct >= 50) return "text-yellow-400";
  return "text-red-400";
}

export default async function RankingPage() {
  const t = await getTranslations("ranking");
  const tc = await getTranslations("common");

  const repo = new PrismaScanRepository();
  let ranking: Awaited<ReturnType<typeof repo.findRanking>> = [];
  try {
    ranking = await repo.findRanking(50);
  } catch {
    // DB not available during build
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold">
          <span className="text-emerald-400">OWASP</span>Checker
        </Link>
        <div className="flex items-center gap-4">
          <LanguageSwitcher />
          <Link href="/dashboard" className="text-sm text-gray-400 hover:text-white transition-colors">
            {tc("dashboard")}
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-10 space-y-8">
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-gray-400 text-sm mt-1">{t("subtitle")}</p>
        </div>

        {ranking.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-700 p-10 text-center text-gray-500">
            {t("noSites")}
          </div>
        ) : (
          <ol className="space-y-3">
            {ranking.map((entry, idx) => (
              <li key={entry.id} className="rounded-xl border border-gray-800 p-4 flex items-center gap-4">
                <span className="text-gray-500 font-mono text-sm w-6 text-right shrink-0">{idx + 1}</span>
                <div className="flex-1 min-w-0">
                  <span className="font-medium truncate block">{entry.websiteDomain}</span>
                  <span className="text-xs text-gray-500">
                    {t("scannedOn", { date: new Date(entry.startedAt).toLocaleDateString() })}
                  </span>
                </div>
                <div className="text-right shrink-0">
                  {entry.score !== null && entry.maxScore !== null && (
                    <>
                      <span className={`text-xl font-bold ${scoreColor(entry.score, entry.maxScore)}`}>
                        {entry.score}
                      </span>
                      <span className="text-gray-500 text-sm">/{entry.maxScore}</span>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </main>
    </div>
  );
}
