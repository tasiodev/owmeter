import { redirect, notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { auth } from "@/infrastructure/auth/auth";
import { PrismaProjectRepository } from "@/infrastructure/database/repositories/PrismaProjectRepository";
import { PrismaScanRepository } from "@/infrastructure/database/repositories/PrismaScanRepository";
import { PrismaFalsePositiveReportRepository } from "@/infrastructure/database/repositories/PrismaFalsePositiveReportRepository";
import { ScanResult } from "@/presentation/components/scan/ScanResult";
import { fpKey } from "@/domain/entities/FalsePositiveReport";

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
  const fpRepo = new PrismaFalsePositiveReportRepository();

  const project = await projectRepo.findById(id);
  if (!project || project.userId !== session.user.id) notFound();

  const [scan, allFpReports] = await Promise.all([
    scanRepo.findById(scanId),
    fpRepo.findByProject(id),
  ]);

  if (!scan || scan.projectId !== id) notFound();

  const approvedFpKeys = new Set(
    allFpReports
      .filter((r) => r.status === "APPROVED")
      .map((r) => fpKey(r.category, r.title, r.filePath))
  );
  const reportedFpKeys = new Map(
    allFpReports.map((r) => [fpKey(r.category, r.title, r.filePath), r.status])
  );

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

      <ScanResult
        scan={scan}
        projectId={id}
        repoVerified={project.repoVerified}
        approvedFpKeys={approvedFpKeys}
        reportedFpKeys={reportedFpKeys}
      />
    </div>
  );
}

