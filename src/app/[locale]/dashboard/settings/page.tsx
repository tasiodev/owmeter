import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/infrastructure/auth/auth";
import { PrismaGitHubInstallationRepository } from "@/infrastructure/database/repositories/PrismaGitHubInstallationRepository";
import { GitHubAppConnectionCard } from "@/presentation/components/dashboard/settings/GitHubAppConnectionCard";
import { isGitHubAppEnabled } from "@/infrastructure/github/isGitHubAppEnabled";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const session = await auth();
  const { locale } = await params;
  if (!session?.user?.id) redirect(`/${locale}/login`);

  const ts = await getTranslations("settings");

  const gitHubAppEnabled = isGitHubAppEnabled();

  const installation = gitHubAppEnabled
    ? await new PrismaGitHubInstallationRepository().findByUserId(session.user.id)
    : null;

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">{ts("title")}</h1>
        <p className="text-sm text-gray-500 mt-1">{ts("subtitle")}</p>
      </div>

      {gitHubAppEnabled ? (
        <GitHubAppConnectionCard installation={installation} />
      ) : (
        <div className="rounded-xl border border-dashed border-gray-700 p-6 text-center space-y-1">
          <p className="text-sm font-medium text-gray-400">{ts("noIntegrations")}</p>
          <p className="text-xs text-gray-600">{ts("noIntegrationsHint")}</p>
        </div>
      )}
    </div>
  );
}
