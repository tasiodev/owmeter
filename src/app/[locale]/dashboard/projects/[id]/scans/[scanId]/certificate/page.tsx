import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { auth } from "@/infrastructure/auth/auth";
import { PrismaProjectRepository } from "@/infrastructure/database/repositories/PrismaProjectRepository";
import { PrismaScanRepository } from "@/infrastructure/database/repositories/PrismaScanRepository";
import { OWASP_CATEGORIES, isEvaluated, PASSIVE_UNEVALUATED, CODE_UNEVALUATED } from "@/domain/value-objects/OWASPCategory";
import type { OWASPCategoryId } from "@/domain/value-objects/OWASPCategory";
import type { Finding } from "@/domain/entities/Scan";
import { PrintButton } from "@/presentation/components/scan/PrintButton";

function scoreColor(score: number) {
  if (score >= 80) return { ring: "#34d399", text: "text-emerald-400" };
  if (score >= 50) return { ring: "#facc15", text: "text-yellow-400" };
  return { ring: "#f87171", text: "text-red-400" };
}

function ScoreArc({ score, maxScore }: { score: number; maxScore: number }) {
  const pct = maxScore > 0 ? score / maxScore : 0;
  const { ring, text } = scoreColor(score);
  const size = 140;
  const sw = 10;
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <div className="relative w-36 h-36 mx-auto">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={sw} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={ring} strokeWidth={sw}
          strokeLinecap="round" strokeDasharray={`${circ * pct} ${circ}`} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-4xl font-bold ${text}`}>{score}</span>
        <span className="text-xs text-gray-500">/ {maxScore}</span>
      </div>
    </div>
  );
}

function CategoryRow({ id, cat, findings, scanType, naReason }: {
  id: OWASPCategoryId;
  cat: typeof OWASP_CATEGORIES[OWASPCategoryId];
  findings: Finding[];
  scanType: string;
  naReason: string;
}) {
  const evaluated = isEvaluated(id, scanType as "PASSIVE" | "FULL" | "CODE");
  const hasFindings = evaluated && findings.some(f => f.category === id);

  if (!evaluated) {
    const reason = naReason;
    return (
      <li className="flex items-center gap-3 py-1.5 text-sm text-gray-400 print:text-gray-500">
        <span className="w-4 text-center text-gray-500 font-bold">–</span>
        <span className="flex-1">{cat.name}</span>
        <span className="text-xs text-gray-500 italic">{reason}</span>
      </li>
    );
  }

  if (hasFindings)
    return (
      <li className="flex items-center gap-3 py-1.5 text-sm text-amber-300 print:text-amber-700">
        <span className="w-4 text-center">⚠</span>
        <span className="flex-1 text-gray-200 print:text-gray-800">{cat.name}</span>
        <span className="text-xs text-amber-400 print:text-amber-700">
          issues found
        </span>
      </li>
    );

  return (
    <li className="flex items-center gap-3 py-1.5 text-sm text-emerald-400 print:text-emerald-700">
      <span className="w-4 text-center">✓</span>
      <span className="flex-1 text-gray-200 print:text-gray-800">{cat.name}</span>
    </li>
  );
}

export default async function CertificatePage({
  params,
}: {
  params: Promise<{ locale: string; id: string; scanId: string }>;
}) {
  const { locale, id, scanId } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect(`/${locale}/login`);

  const t = await getTranslations("certificate");
  const tScan = await getTranslations("scan");

  const projectRepo = new PrismaProjectRepository();
  const scanRepo = new PrismaScanRepository();

  const project = await projectRepo.findById(id);
  if (!project || project.userId !== session.user.id) notFound();

  const scan = await scanRepo.findById(scanId);
  if (!scan || scan.projectId !== id || scan.status !== "COMPLETED") notFound();

  const score = scan.score ?? 0;
  const maxScore = scan.maxScore ?? 100;
  const completedAt = scan.completedAt ? new Date(scan.completedAt).toLocaleDateString() : "—";

  return (
    <>
      {/* Print-only page sizing */}
      <style>{`@media print { @page { size: A4; margin: 16mm; } }`}</style>

      <div className="min-h-screen bg-gray-950 print:bg-white py-10 px-4">
        {/* Nav — hidden when printing */}
        <div className="max-w-2xl mx-auto mb-6 flex items-center justify-between print:hidden">
          <Link
            href={`/dashboard/projects/${id}/scans/${scanId}`}
            className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            ← {t("back")}
          </Link>
          <PrintButton label={t("print")} />
        </div>

        {/* Certificate card */}
        <div className="max-w-2xl mx-auto rounded-2xl border border-gray-800 bg-gray-900 print:border-gray-300 print:bg-white p-10 space-y-8">
          {/* Header */}
          <div className="text-center space-y-1">
            <p className="text-xs font-semibold tracking-widest text-gray-500 print:text-gray-400 uppercase">
              OwaspChecker
            </p>
            <h1 className="text-2xl font-bold text-white print:text-gray-900">{t("title")}</h1>
            <p className="text-sm text-gray-400 print:text-gray-600">{t("subtitle")}</p>
          </div>

          {/* Project identity */}
          <div className="text-center">
            <p className="text-lg font-semibold text-white print:text-gray-900">{project.name}</p>
            {project.domain && (
              <p className="text-sm text-gray-400 print:text-gray-500">{project.domain}</p>
            )}
          </div>

          {/* Score */}
          <div className="text-center space-y-2">
            <ScoreArc score={score} maxScore={maxScore} />
            <p className="text-sm text-gray-400 print:text-gray-600">{t("score")}</p>
          </div>

          <hr className="border-gray-800 print:border-gray-200" />

          {/* Category list */}
          <div>
            <p className="text-xs font-semibold tracking-wider text-gray-500 print:text-gray-400 uppercase mb-3">
              {t("categoryBreakdown")}
            </p>
            <ul className="divide-y divide-gray-800 print:divide-gray-100">
              {(Object.entries(OWASP_CATEGORIES) as [OWASPCategoryId, typeof OWASP_CATEGORIES[OWASPCategoryId]][]).map(
                ([catId, cat]) => {
                  const naReason = PASSIVE_UNEVALUATED.has(catId)
                    ? tScan("notEvaluatedDesc")
                    : CODE_UNEVALUATED.has(catId)
                    ? tScan("notEvaluatedServerDesc")
                    : tScan("notEvaluatedLabel");
                  return (
                    <CategoryRow
                      key={catId}
                      id={catId}
                      cat={cat}
                      findings={scan.findings}
                      scanType={scan.type}
                      naReason={naReason}
                    />
                  );
                }
              )}
            </ul>
          </div>

          <hr className="border-gray-800 print:border-gray-200" />

          {/* Footer metadata */}
          <div className="flex justify-between text-xs text-gray-500 print:text-gray-400">
            <span>
              {t("scanType")}: <span className="font-medium text-gray-300 print:text-gray-600">{scan.type}</span>
            </span>
            <span>
              {t("completedAt")}: <span className="font-medium text-gray-300 print:text-gray-600">{completedAt}</span>
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
