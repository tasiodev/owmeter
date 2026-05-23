import { redirect } from "next/navigation";
import { auth } from "@/infrastructure/auth/auth";
import { isAdmin } from "@/infrastructure/auth/isAdmin";
import { PrismaFalsePositiveReportRepository } from "@/infrastructure/database/repositories/PrismaFalsePositiveReportRepository";
import { AdminFalsePositivesList } from "@/presentation/components/admin/AdminFalsePositivesList";

export default async function AdminFalsePositivesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const session = await auth();
  const { locale } = await params;

  if (!session?.user?.email || !isAdmin(session.user.email)) {
    redirect(`/${locale}/dashboard`);
  }

  const reports = await new PrismaFalsePositiveReportRepository().findAllWithDetails();

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">False Positive Reports</h1>
        <p className="text-sm text-gray-400 mt-1">Review user-submitted false positive reports for scan findings.</p>
      </div>
      <AdminFalsePositivesList reports={reports} />
    </div>
  );
}
