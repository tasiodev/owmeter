import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { auth } from "@/infrastructure/auth/auth";
import { PrismaProjectRepository } from "@/infrastructure/database/repositories/PrismaProjectRepository";
import { PrismaScanRepository } from "@/infrastructure/database/repositories/PrismaScanRepository";
import { AddProjectForm } from "@/presentation/components/dashboard/AddProjectForm";
import type { Scan } from "@/domain/entities/Scan";
import type { Project } from "@/domain/entities/Project";

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

function ProjectTypeBadge({ type }: { type: Project["type"] }) {
  if (type === "CODE_REPO") {
    return (
      <span className="text-xs bg-purple-900/40 text-purple-400 px-2 py-0.5 rounded-full">
        Code
      </span>
    );
  }
  return (
    <span className="text-xs bg-blue-900/40 text-blue-400 px-2 py-0.5 rounded-full">
      Website
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

      <AddProjectForm />

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
                className="rounded-xl border border-gray-800 p-5 flex items-center justify-between gap-4 hover:border-gray-600 hover:bg-gray-900/40 transition-colors block"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{project.name}</span>
                    <ProjectTypeBadge type={project.type} />
                    {project.type === "WEBSITE" && (
                      project.verified ? (
                        <span className="text-xs bg-emerald-900/40 text-emerald-400 px-2 py-0.5 rounded-full">
                          {t("verifiedBadge")}
                        </span>
                      ) : (
                        <span className="text-xs bg-yellow-900/40 text-yellow-400 px-2 py-0.5 rounded-full">
                          {t("unverifiedBadge")}
                        </span>
                      )
                    )}
                  </div>
                  {project.domain && (
                    <p className="text-xs text-gray-500">{project.domain}</p>
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
    </div>
  );
}
