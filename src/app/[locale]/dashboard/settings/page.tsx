import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth, signOut } from "@/infrastructure/auth/auth";
import { Link } from "@/i18n/navigation";
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
  const tc = await getTranslations("common");

  const gitHubAppEnabled = isGitHubAppEnabled();

  const installation = gitHubAppEnabled
    ? await new PrismaGitHubInstallationRepository().findByUserId(session.user.id)
    : null;

  const { name, email, image } = session.user;
  const initials = (name ?? email ?? "?")
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 space-y-8">
      {/* back link */}
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-200 transition-colors group w-fit"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-4 h-4 transition-transform group-hover:-translate-x-0.5"
          aria-hidden="true"
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
        {tc("dashboard")}
      </Link>

      {/* page heading */}
      <div>
        <h1 className="text-2xl font-semibold">{ts("title")}</h1>
        <p className="text-sm text-gray-500 mt-1">{ts("subtitle")}</p>
      </div>

      {/* ── account card ── */}
      <section className="rounded-xl border border-gray-800 divide-y divide-gray-800">
        {/* header row */}
        <div className="px-5 py-4">
          <p className="text-sm font-medium text-gray-200">{ts("accountTitle")}</p>
          <p className="text-xs text-gray-500 mt-0.5">{ts("accountDesc")}</p>
        </div>

        {/* user row */}
        <div className="px-5 py-4 flex items-center gap-4">
          {/* avatar */}
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image}
              alt={name ?? email ?? ""}
              referrerPolicy="no-referrer"
              className="w-11 h-11 rounded-full shrink-0 ring-1 ring-gray-700"
            />
          ) : (
            <span className="w-11 h-11 rounded-full shrink-0 bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-semibold text-sm select-none">
              {initials}
            </span>
          )}

          {/* name + email */}
          <div className="min-w-0 flex-1">
            {name && (
              <p className="text-sm font-medium text-gray-100 truncate">{name}</p>
            )}
            <p className="text-sm text-gray-400 truncate">{email}</p>
          </div>
        </div>

        {/* sign-out row */}
        <div className="px-5 py-4 flex items-center justify-between gap-4">
          <p className="text-xs text-gray-500">{ts("signOutDesc")}</p>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: `/${locale}` });
            }}
          >
            <button
              type="submit"
              className="text-xs px-3 py-1.5 rounded-lg border border-red-900 text-red-400 hover:border-red-700 hover:text-red-300 hover:bg-red-950/30 transition-colors shrink-0"
            >
              {ts("signOutBtn")}
            </button>
          </form>
        </div>
      </section>

      {/* ── integrations ── */}
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
