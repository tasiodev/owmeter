import { redirect, notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { auth } from "@/infrastructure/auth/auth";
import { PrismaProjectRepository } from "@/infrastructure/database/repositories/PrismaProjectRepository";
import { ScanTypeSelector } from "@/presentation/components/scan/ScanTypeSelector";

export default async function ScanPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const session = await auth();
  const { locale, id } = await params;
  if (!session?.user?.id) redirect(`/${locale}/login`);

  const t = await getTranslations("scan");

  const projectRepo = new PrismaProjectRepository();
  const project = await projectRepo.findById(id);
  if (!project || project.userId !== session.user.id) notFound();

  // WEBSITE requires domain verification; CODE_REPO always allows (ZIP upload available)
  if (project.type === "WEBSITE" && !project.verified) {
    redirect(`/${locale}/dashboard/projects/${id}`);
  }

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
        <p className="text-gray-400 text-sm mt-1">{t("subtitle")}</p>
      </div>

      <div className="rounded-xl border border-gray-700 p-8">
        <ScanTypeSelector
          projectId={id}
          projectType={project.type}
          hasVerifiedRepo={project.repoVerified}
          redirectTo={`/dashboard/projects/${id}`}
        />
      </div>
    </div>
  );
}
