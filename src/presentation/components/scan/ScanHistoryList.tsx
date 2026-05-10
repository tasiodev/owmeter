import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Scan } from "@/domain/entities/Scan";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-gray-800 text-gray-400",
  RUNNING: "bg-blue-900/40 text-blue-400",
  COMPLETED: "bg-emerald-900/40 text-emerald-400",
  FAILED: "bg-red-900/40 text-red-400",
};

function scoreColor(pct: number | null) {
  if (pct === null) return "text-gray-500";
  if (pct >= 80) return "text-emerald-400";
  if (pct >= 50) return "text-yellow-400";
  return "text-red-400";
}

export async function ScanHistoryList({
  scans,
  websiteId,
  activeScanId,
}: {
  scans: Scan[];
  websiteId: string;
  activeScanId?: string;
}) {
  if (scans.length === 0) return null;

  const t = await getTranslations("scan");

  return (
    <div className="space-y-3">
      <h2 className="text-base font-semibold text-gray-300">{t("history.title")}</h2>
      <ul className="space-y-2">
        {scans.map((scan, i) => {
          const pct =
            scan.score !== null && scan.maxScore !== null
              ? Math.round((scan.score / scan.maxScore) * 100)
              : null;
          const isActive = scan.id === activeScanId;

          return (
            <li key={scan.id}>
              <Link
                href={`/dashboard/websites/${websiteId}/scans/${scan.id}`}
                className={`flex items-center justify-between rounded-xl border px-4 py-3 transition-colors ${
                  isActive
                    ? "border-gray-600 bg-gray-800/60"
                    : "border-gray-800 hover:border-gray-600 hover:bg-gray-900/40"
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {i === 0 && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-gray-700 text-gray-300">
                        {t("history.latest")}
                      </span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      scan.type === "COMPLETE"
                        ? "bg-violet-900/40 text-violet-300"
                        : "bg-gray-800 text-gray-400"
                    }`}>
                      {scan.type === "COMPLETE" ? t("scanTypeBadge") : t("scanTypeBasicBadge")}
                    </span>
                    {(scan.status === "RUNNING" || scan.status === "PENDING" || scan.status === "FAILED") && (
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[scan.status]}`}
                      >
                        {scan.status}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    {new Date(scan.startedAt).toLocaleString()}
                  </p>
                </div>
                <span className={`text-base font-mono font-bold ${scoreColor(pct)}`}>
                  {scan.score !== null && scan.maxScore !== null
                    ? `${scan.score}/${scan.maxScore}`
                    : "—"}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
