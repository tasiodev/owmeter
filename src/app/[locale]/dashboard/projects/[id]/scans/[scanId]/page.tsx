import { redirect, notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { auth } from "@/infrastructure/auth/auth";
import { PrismaProjectRepository } from "@/infrastructure/database/repositories/PrismaProjectRepository";
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

  const projectRepo = new PrismaProjectRepository();
  const scanRepo = new PrismaScanRepository();

  const project = await projectRepo.findById(id);
  if (!project || project.userId !== session.user.id) notFound();

  const [scan, allScans] = await Promise.all([
    scanRepo.findById(scanId),
    scanRepo.findByProjectId(id),
  ]);

  if (!scan || scan.projectId !== id) notFound();

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
      <div>
        <Link
          href={`/dashboard/projects/${id}`}
          className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
        >
          ← {project.name}
        </Link>
        <h1 className="text-2xl font-semibold mt-2">{project.name}</h1>
        <p className="text-gray-400 text-sm mt-1">
          {t("history.scanFrom", { date: new Date(scan.startedAt).toLocaleString() })}
        </p>
      </div>

      <ScanResult scan={scan} projectId={id} repoVerified={project.repoVerified} />

      <ScanHistoryList scans={allScans} projectId={id} activeScanId={scanId} />
    </div>
  );
}
