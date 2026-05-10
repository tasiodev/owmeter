import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { auth } from "@/infrastructure/auth/auth";
import { PrismaWebsiteRepository } from "@/infrastructure/database/repositories/PrismaWebsiteRepository";
import { AddWebsiteForm } from "@/presentation/components/dashboard/AddWebsiteForm";

export default async function DashboardPage() {
  const session = await auth();

  const t = await getTranslations("dashboard");

  const repo = new PrismaWebsiteRepository();
  let websites: Awaited<ReturnType<typeof repo.findByUserId>> = [];
  try {
    websites = await repo.findByUserId(session!.user!.id!);
  } catch {
    // DB not ready during build
  }

  return (
    <div className="max-w-4xl mx-auto w-full px-6 py-10 space-y-10">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-gray-400 text-sm">{t("subtitle")}</p>
      </div>

      <AddWebsiteForm />

      {websites.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-700 p-10 text-center text-gray-500">
          {t("noWebsites")}
        </div>
      ) : (
        <ul className="space-y-4">
          {websites.map((site) => (
            <li
              key={site.id}
              className="rounded-xl border border-gray-800 p-5 flex items-center justify-between gap-4"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{site.domain}</span>
                  {site.verified ? (
                    <span className="text-xs bg-emerald-900/40 text-emerald-400 px-2 py-0.5 rounded-full">
                      {t("verifiedBadge")}
                    </span>
                  ) : (
                    <span className="text-xs bg-yellow-900/40 text-yellow-400 px-2 py-0.5 rounded-full">
                      {t("unverifiedBadge")}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  {t("addedOn", { date: new Date(site.createdAt).toLocaleDateString() })}
                </p>
              </div>
              <Link
                href={`/dashboard/websites/${site.id}`}
                className="text-sm px-4 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition-colors shrink-0"
              >
                {t("access")}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
