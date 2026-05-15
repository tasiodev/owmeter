import { redirect, notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { auth } from "@/infrastructure/auth/auth";
import { PrismaProjectRepository } from "@/infrastructure/database/repositories/PrismaProjectRepository";
import { PrismaScanRepository } from "@/infrastructure/database/repositories/PrismaScanRepository";
import { getDomainVerificationInstructions } from "@/domain/entities/Project";
import { VerifyDomainForm } from "@/presentation/components/dashboard/VerifyDomainForm";
import { VerifyRepoForm } from "@/presentation/components/dashboard/VerifyRepoForm";
import { DeleteProjectButton } from "@/presentation/components/dashboard/DeleteProjectButton";
import { ScanHistoryList } from "@/presentation/components/scan/ScanHistoryList";
import { LastScanCard } from "@/presentation/components/scan/LastScanCard";
import { ApiKeyCard } from "@/presentation/components/dashboard/ApiKeyCard";
import { BadgeCard } from "@/presentation/components/dashboard/BadgeCard";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const session = await auth();
  const { locale, id } = await params;
  if (!session?.user?.id) redirect(`/${locale}/login`);

  const ts = await getTranslations("site");
  const tv = await getTranslations("verify");
  const tvr = await getTranslations("verifyRepo");
  const ta = await getTranslations("apiKey");
  const tsh = await getTranslations("scan"); // used for sidebar label only

  const projectRepo = new PrismaProjectRepository();
  const scanRepo = new PrismaScanRepository();

  const project = await projectRepo.findById(id);
  if (!project || project.userId !== session.user.id) notFound();

  const scans = await scanRepo.findByProjectId(id);

  const domainMethods = ["DNS_TXT", "META_TAG", "FILE"] as const;
  const methodLabels: Record<(typeof domainMethods)[number], string> = {
    DNS_TXT: tv("dnsTxt"),
    META_TAG: tv("metaTag"),
    FILE: tv("file"),
  };

  const canScan = project.type === "WEBSITE" ? project.verified : project.repoVerified;

  const featuredScan =
    scans.find((s) => s.status === "RUNNING") ??
    scans.find((s) => s.status === "PENDING") ??
    scans.find((s) => s.status === "COMPLETED");

  const navItems = [
    canScan && { href: "#scan", label: ts("lastScanTitle") },
    project.type === "WEBSITE" && { href: "#domain", label: ts("ownership") },
    { href: "#repo", label: ts("repoOwnership") },
    { href: "#cicd", label: ta("title") },
    { href: "#badge", label: ta("badgeTitle") },
    scans.length > 0 && { href: "#history", label: tsh("history.title") },
  ].filter(Boolean) as { href: string; label: string }[];

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      {/* Header — full width */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
            ← {ts("backToDashboard")}
          </Link>
          <h1 className="text-2xl font-semibold mt-2 flex items-center gap-2">
            {project.name}
            {project.type === "WEBSITE" && project.domain && (
              <a
                href={`https://${project.domain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:text-blue-400 transition-colors"
                aria-label={`Visit ${project.domain}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M7 17L17 7" />
                  <path d="M7 7h10v10" />
                </svg>
              </a>
            )}
          </h1>
          {project.domain && (
            <p className="text-sm text-gray-500 mt-0.5">{project.domain}</p>
          )}
        </div>
        <DeleteProjectButton projectId={id} />
      </div>

      {/* Sidebar + content */}
      <div className="flex gap-10">
        {/* Sidebar nav */}
        <aside className="hidden lg:block w-44 shrink-0">
          <nav className="sticky top-8 space-y-0.5">
            {navItems.map(({ href, label }) => (
              <a
                key={href}
                href={href}
                className="block px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-gray-100 hover:bg-gray-800 transition-colors"
              >
                {label}
              </a>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-10">

          {/* Last scan */}
          {canScan && (
            <section id="scan" className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">{ts("lastScanTitle")}</h2>
                <Link
                  href={`/dashboard/projects/${id}/scan`}
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm font-medium transition-colors"
                >
                  {ts("newScan")}
                </Link>
              </div>
              {featuredScan ? (
                <LastScanCard scan={featuredScan} projectId={id} />
              ) : (
                <div className="rounded-xl border border-dashed border-gray-700 p-10 text-center text-sm text-gray-500">
                  {ts("noScans")}
                </div>
              )}
            </section>
          )}

          {/* Domain verification (WEBSITE only) */}
          {project.type === "WEBSITE" && (
            <section id="domain" className="rounded-xl border border-gray-800 p-4 space-y-4">
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-semibold">{ts("ownership")}</h2>
                {project.verified ? (
                  <span className="text-xs bg-emerald-900/40 text-emerald-400 px-2 py-0.5 rounded-full">
                    {ts("verified")}
                  </span>
                ) : (
                  <span className="text-xs bg-yellow-900/40 text-yellow-400 px-2 py-0.5 rounded-full">
                    {ts("unverified")}
                  </span>
                )}
                {project.verified && (
                  <span className="ml-auto text-xs text-gray-500">
                    {ts("verifiedOn", { date: new Date(project.verifiedAt!).toLocaleDateString() })}
                  </span>
                )}
              </div>

              {!project.verified && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-400">{tv("subtitle")}</p>
                  {domainMethods.map((method) => (
                    <div key={method} className="rounded-lg border border-gray-700 p-4 space-y-3">
                      <h3 className="text-sm font-medium text-gray-200">{methodLabels[method]}</h3>
                      <pre className="text-xs bg-gray-900 rounded-lg p-3 overflow-x-auto text-emerald-300 whitespace-pre-wrap break-all">
                        {getDomainVerificationInstructions(project.domain!, project.verificationToken, method)}
                      </pre>
                      <VerifyDomainForm projectId={id} method={method} />
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Repo verification */}
          <section id="repo" className="rounded-xl border border-gray-800 p-4 space-y-4">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold">{ts("repoOwnership")}</h2>
              {project.repoVerified ? (
                <span className="text-xs bg-emerald-900/40 text-emerald-400 px-2 py-0.5 rounded-full">
                  {ts("verified")}
                </span>
              ) : (
                <span className="text-xs bg-yellow-900/40 text-yellow-400 px-2 py-0.5 rounded-full">
                  {project.type === "CODE_REPO" ? ts("unverified") : ts("optional")}
                </span>
              )}
              {project.repoVerified && (
                <span className="ml-auto text-xs text-gray-500">
                  {ts("verifiedOn", { date: new Date(project.repoVerifiedAt!).toLocaleDateString() })}
                </span>
              )}
              {project.repoVerified && project.repoUrl && (
                <a
                  href={project.repoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  {project.repoUrl}
                </a>
              )}
            </div>

            {!project.repoVerified && (
              <div className="space-y-3">
                <p className="text-sm text-gray-400">
                  {project.type === "CODE_REPO" ? tvr("subtitleRequired") : tvr("subtitleOptional")}
                </p>
                <VerifyRepoForm
                  projectId={id}
                  token={project.repoVerificationToken ?? project.verificationToken}
                />
              </div>
            )}
          </section>

          {/* CI/CD integration */}
          <section id="cicd">
            <ApiKeyCard projectId={id} initialApiKey={project.apiKey} />
          </section>

          {/* Badge */}
          <section id="badge">
            <BadgeCard projectId={id} />
          </section>

          {/* Scan history */}
          {scans.length > 0 && (
            <section id="history">
              <ScanHistoryList scans={scans} projectId={id} />
            </section>
          )}

        </div>
      </div>
    </div>
  );
}
