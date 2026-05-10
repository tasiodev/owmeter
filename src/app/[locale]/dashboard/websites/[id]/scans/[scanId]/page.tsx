import { redirect, notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { auth } from "@/infrastructure/auth/auth";
import { PrismaWebsiteRepository } from "@/infrastructure/database/repositories/PrismaWebsiteRepository";
import { PrismaScanRepository } from "@/infrastructure/database/repositories/PrismaScanRepository";
import { ScanResult } from "@/presentation/components/scan/ScanResult";
import { ScanHistoryList } from "@/presentation/components/scan/ScanHistoryList";

export default async function ScanDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string; scanId: string }>;
}) {
  const session = await auth();
  const { locale, id, scanId } = await params;
  if (!session?.user?.id) redirect(`/${locale}/login`);

  const t = await getTranslations("scan");

  const websiteRepo = new PrismaWebsiteRepository();
  const scanRepo = new PrismaScanRepository();

  const website = await websiteRepo.findById(id);
  if (!website || website.userId !== session.user.id) notFound();

  const [scan, allScans] = await Promise.all([
    scanRepo.findById(scanId),
    scanRepo.findByWebsiteId(id),
  ]);

  if (!scan || scan.websiteId !== id) notFound();

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
      <div>
        <Link
          href={`/dashboard/websites/${id}`}
          className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
        >
          ← {website.domain}
        </Link>
        <h1 className="text-2xl font-semibold mt-2 flex items-center gap-2">
          {website.domain}
          <a
            href={`https://${website.domain}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:text-blue-400 transition-colors"
            aria-label={`Visit ${website.domain}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M7 17L17 7" />
              <path d="M7 7h10v10" />
            </svg>
          </a>
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          {t("history.scanFrom", {
            date: new Date(scan.startedAt).toLocaleString(),
          })}
        </p>
      </div>

      <ScanResult scan={scan} />

      <ScanHistoryList scans={allScans} websiteId={id} activeScanId={scanId} />
    </div>
  );
}
