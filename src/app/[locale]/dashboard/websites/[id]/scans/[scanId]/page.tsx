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
        <h1 className="text-2xl font-semibold mt-2">{website.domain}</h1>
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
