import { PrismaFalsePositiveReportRepository } from "@/infrastructure/database/repositories/PrismaFalsePositiveReportRepository";
import { AdminFalsePositivesList } from "@/presentation/components/admin/AdminFalsePositivesList";

export default async function AdminFalsePositivesPage() {
  const reports = await new PrismaFalsePositiveReportRepository().findAllWithDetails();

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">False Positive Reports</h2>
        <p className="text-sm text-gray-400 mt-1">Review user-submitted false positive reports for scan findings.</p>
      </div>
      <AdminFalsePositivesList reports={reports} />
    </div>
  );
}
