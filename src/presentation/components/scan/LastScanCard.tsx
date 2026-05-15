import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Scan } from "@/domain/entities/Scan";
import type { Severity } from "@/domain/value-objects/Severity";
import { ScanPoller } from "./ScanPoller";

const SEVERITY_ORDER: Severity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"];

const SEVERITY_STYLE: Record<Severity, { dot: string; text: string; bg: string }> = {
  CRITICAL: { dot: "bg-red-500",    text: "text-red-400",    bg: "bg-red-900/30" },
  HIGH:     { dot: "bg-orange-500", text: "text-orange-400", bg: "bg-orange-900/30" },
  MEDIUM:   { dot: "bg-yellow-500", text: "text-yellow-400", bg: "bg-yellow-900/30" },
  LOW:      { dot: "bg-blue-500",   text: "text-blue-400",   bg: "bg-blue-900/30" },
  INFO:     { dot: "bg-gray-500",   text: "text-gray-400",   bg: "bg-gray-800" },
};

function ScoreRing({ score, maxScore }: { score: number; maxScore: number }) {
  const pct = maxScore > 0 ? score / maxScore : 0;
  const pctRounded = Math.round(pct * 100);
  const strokeColor =
    pctRounded >= 80 ? "#34d399" : pctRounded >= 50 ? "#facc15" : "#f87171";

  const size = 140;
  const sw = 10;
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * pct;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1f2937" strokeWidth={sw} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={strokeColor}
          strokeWidth={sw}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-bold" style={{ color: strokeColor }}>
          {score}
        </span>
        <span className="text-sm text-gray-500">/ {maxScore}</span>
      </div>
    </div>
  );
}

function SpinningRing() {
  const size = 140;
  const sw = 10;
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1f2937" strokeWidth={sw} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#60a5fa"
          strokeWidth={sw}
          strokeLinecap="round"
          strokeDasharray={`${circ * 0.25} ${circ * 0.75}`}
          className="animate-spin"
          style={{ transformOrigin: "50% 50%" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-blue-400 text-2xl animate-pulse">···</span>
      </div>
    </div>
  );
}

export async function LastScanCard({
  scan,
  projectId,
}: {
  scan: Scan;
  projectId: string;
}) {
  const t = await getTranslations("site");

  const isActive = scan.status === "RUNNING" || scan.status === "PENDING";

  const countBySeverity = SEVERITY_ORDER.reduce<Record<Severity, number>>(
    (acc, s) => ({ ...acc, [s]: scan.findings.filter((f) => f.severity === s).length }),
    {} as Record<Severity, number>
  );

  const hasFindings = SEVERITY_ORDER.some((s) => countBySeverity[s] > 0);

  return (
    <>
      {isActive && <ScanPoller scanId={scan.id} />}
    <Link
      href={`/dashboard/projects/${projectId}/scans/${scan.id}`}
      className="group block rounded-xl border border-gray-700 bg-gray-900/40 p-6 hover:border-gray-500 hover:bg-gray-800/40 transition-colors"
    >
      <div className="flex items-center gap-6">
        {isActive ? (
          <SpinningRing />
        ) : scan.score !== null && scan.maxScore !== null ? (
          <ScoreRing score={scan.score} maxScore={scan.maxScore} />
        ) : (
          <div className="relative shrink-0" style={{ width: 140, height: 140 }}>
            <svg width={140} height={140} style={{ transform: "rotate(-90deg)" }}>
              <circle cx={70} cy={70} r={65} fill="none" stroke="#1f2937" strokeWidth={10} />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-gray-500 text-2xl">—</span>
            </div>
          </div>
        )}

        <div className="flex-1 space-y-3">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">
              {t("lastScanTitle")}
            </p>
            <p className="text-sm text-gray-400 mt-0.5">
              {new Date(scan.startedAt).toLocaleString()}
            </p>
          </div>

          {isActive ? (
            <p className="text-sm text-blue-400 animate-pulse">{t("scanRunning")}</p>
          ) : hasFindings ? (
            <div className="flex flex-wrap gap-2">
              {SEVERITY_ORDER.map((s) =>
                countBySeverity[s] > 0 ? (
                  <span
                    key={s}
                    className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${SEVERITY_STYLE[s].bg} ${SEVERITY_STYLE[s].text}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${SEVERITY_STYLE[s].dot}`} />
                    {s} {countBySeverity[s]}
                  </span>
                ) : null
              )}
            </div>
          ) : null}

          <p className="text-xs text-gray-500 group-hover:text-gray-300 transition-colors">
            {t("viewDetails")} →
          </p>
        </div>
      </div>
    </Link>
    </>
  );
}
