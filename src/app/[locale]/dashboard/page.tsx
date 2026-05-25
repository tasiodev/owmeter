import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { auth } from "@/infrastructure/auth/auth";
import { PrismaProjectRepository } from "@/infrastructure/database/repositories/PrismaProjectRepository";
import { PrismaScanRepository } from "@/infrastructure/database/repositories/PrismaScanRepository";
import { AddProjectForm } from "@/presentation/components/dashboard/AddProjectForm";
import type { Scan } from "@/domain/entities/Scan";

function MiniScoreRing({ scan }: { scan: Scan | undefined }) {
  const size = 48;
  const sw = 4;
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;

  if (!scan || scan.score === null || scan.maxScore === null) {
    return (
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1f2937" strokeWidth={sw} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-gray-600 text-xs">—</span>
        </div>
      </div>
    );
  }

  const isForeignLang =
    scan.type === "CODE" &&
    scan.findings.some((f) => f.title.startsWith("Limited code analysis:"));

  if (isForeignLang) {
    return (
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1f2937" strokeWidth={sw} />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f97316" strokeWidth={sw} strokeLinecap="round" strokeDasharray={`${circ} 0`} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-orange-400 text-xs font-bold">N/A</span>
        </div>
      </div>
    );
  }

  const pct = scan.score / scan.maxScore;
  const pctRounded = Math.round(pct * 100);
  const color = pctRounded >= 80 ? "#34d399" : pctRounded >= 50 ? "#facc15" : "#f87171";
  const dash = circ * pct;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1f2937" strokeWidth={sw} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeDasharray={`${dash} ${circ}`} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-bold tabular-nums" style={{ color }}>
          {scan.score}
        </span>
      </div>
    </div>
  );
}

function RepoIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8Z" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function ProjectTypeBadge({ label }: { label: string }) {
  return (
    <span className="text-xs border border-gray-600 text-gray-400 px-2 py-0.5 rounded-full whitespace-nowrap">
      {label}
    </span>
  );
}

export default async function DashboardPage() {
  const session = await auth();
  const t = await getTranslations("dashboard");

  const repo = new PrismaProjectRepository();
  const scanRepo = new PrismaScanRepository();
  let projects: Awaited<ReturnType<typeof repo.findByUserId>> = [];
  let latestScans = new Map<string, Scan>();
  try {
    projects = await repo.findByUserId(session!.user!.id!);
    latestScans = await scanRepo.findLatestCompletedPerProject(projects.map((p) => p.id));
  } catch {
    // DB not ready during build
  }

  return (
    <div className="max-w-4xl mx-auto w-full px-6 py-10 space-y-10">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-gray-400 text-sm">{t("subtitle")}</p>
      </div>

      <AddProjectForm>
        {projects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-700 p-10 text-center text-gray-500">
          {t("noProjects")}
        </div>
      ) : (
        <ul className="space-y-4">
          {projects.map((project) => (
            <li key={project.id}>
              <Link
                href={`/dashboard/projects/${project.id}`}
                className="rounded-xl border border-gray-800 p-4 sm:p-5 flex items-center justify-between gap-3 hover:border-gray-600 hover:bg-gray-900/40 transition-colors block"
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <span className="font-medium">{project.name}</span>
                  <div className="flex items-center gap-2 flex-wrap">
                    <ProjectTypeBadge label={t(project.type === "CODE_REPO" ? "typeBadgeCodeRepo" : "typeBadgeWebsite")} />
                    <span
                      title={project.repoVerified ? t("repoVerifiedTitle") : t("repoUnverifiedTitle")}
                      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${project.repoVerified ? "bg-emerald-900/40 text-emerald-400" : "bg-orange-900/40 text-orange-400"}`}
                    >
                      <RepoIcon />
                      {project.repoVerified ? t("verifiedBadge") : t("unverifiedBadge")}
                    </span>
                    {project.type === "WEBSITE" && (
                      <span
                        title={project.verified ? t("domainVerifiedTitle") : t("domainUnverifiedTitle")}
                        className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${project.verified ? "bg-emerald-900/40 text-emerald-400" : "bg-orange-900/40 text-orange-400"}`}
                      >
                        <GlobeIcon />
                        {project.verified ? t("verifiedBadge") : t("unverifiedBadge")}
                      </span>
                    )}
                  </div>
                  {project.domain && (
                    <p className="text-xs text-gray-500 truncate">{project.domain}</p>
                  )}
                  <p className="text-xs text-gray-600">
                    {t("addedOn", { date: new Date(project.createdAt).toLocaleDateString() })}
                  </p>
                </div>
                <MiniScoreRing scan={latestScans.get(project.id)} />
              </Link>
            </li>
          ))}
        </ul>
        )}
      </AddProjectForm>
    </div>
  );
}
