"use client";

import { useEffect, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import type { Scan } from "@/domain/entities/Scan";
import type { Severity } from "@/domain/value-objects/Severity";
import { OWASP_CATEGORIES } from "@/domain/value-objects/OWASPCategory";

const SEVERITY_ORDER: Severity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"];

const SEVERITY_COLORS: Record<Severity, string> = {
  CRITICAL: "text-red-400 bg-red-900/30",
  HIGH: "text-orange-400 bg-orange-900/30",
  MEDIUM: "text-yellow-400 bg-yellow-900/30",
  LOW: "text-blue-400 bg-blue-900/30",
  INFO: "text-gray-400 bg-gray-800",
};

const SEVERITY_BADGE_ACTIVE: Record<Severity, string> = {
  CRITICAL: "bg-red-500 text-white",
  HIGH: "bg-orange-500 text-white",
  MEDIUM: "bg-yellow-500 text-black",
  LOW: "bg-blue-500 text-white",
  INFO: "bg-gray-600 text-white",
};

const SEVERITY_BADGE_INACTIVE: Record<Severity, string> = {
  CRITICAL: "bg-red-900/30 text-red-400 hover:bg-red-900/50",
  HIGH: "bg-orange-900/30 text-orange-400 hover:bg-orange-900/50",
  MEDIUM: "bg-yellow-900/30 text-yellow-400 hover:bg-yellow-900/50",
  LOW: "bg-blue-900/30 text-blue-400 hover:bg-blue-900/50",
  INFO: "bg-gray-800 text-gray-400 hover:bg-gray-700",
};

function ScoreCircle({ score, maxScore }: { score: number; maxScore: number }) {
  const pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  const color = pct >= 80 ? "text-emerald-400" : pct >= 50 ? "text-yellow-400" : "text-red-400";

  return (
    <div className="flex flex-col items-center justify-center rounded-full border-4 border-gray-800 w-28 h-28 shrink-0">
      <span className={`text-3xl font-bold ${color}`}>{score}</span>
      <span className="text-xs text-gray-500">/ {maxScore}</span>
    </div>
  );
}

export function ScanResult({ scan }: { scan: Scan }) {
  const t = useTranslations("scan");
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<Severity | null>(null);

  useEffect(() => {
    if (scan.status !== "PENDING" && scan.status !== "RUNNING") return;
    const interval = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(interval);
  }, [scan.status, router]);

  const statusBadge: Record<string, string> = {
    PENDING: "bg-gray-800 text-gray-400",
    RUNNING: "bg-blue-900/40 text-blue-400",
    COMPLETED: "bg-emerald-900/40 text-emerald-400",
    FAILED: "bg-red-900/40 text-red-400",
  };

  const sorted = [...scan.findings].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity)
  );

  const countBySeverity = SEVERITY_ORDER.reduce<Record<Severity, number>>(
    (acc, s) => ({ ...acc, [s]: scan.findings.filter((f) => f.severity === s).length }),
    {} as Record<Severity, number>
  );

  const visible = activeFilter ? sorted.filter((f) => f.severity === activeFilter) : sorted;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-800 p-6 flex items-center gap-6">
        {scan.score !== null && scan.maxScore !== null ? (
          <ScoreCircle score={scan.score} maxScore={scan.maxScore} />
        ) : (
          <div className="w-28 h-28 rounded-full border-4 border-gray-800 flex items-center justify-center">
            <span className="text-gray-500 text-sm">—</span>
          </div>
        )}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-0.5 rounded-full ${statusBadge[scan.status]}`}>
              {scan.status}
            </span>
          </div>
          <p className="text-sm text-gray-400">
            {t("started", { date: new Date(scan.startedAt).toLocaleString() })}
          </p>
          {scan.completedAt && (
            <p className="text-sm text-gray-400">
              {t("completed", { date: new Date(scan.completedAt).toLocaleString() })}
            </p>
          )}
          {scan.status === "RUNNING" && (
            <p className="text-sm text-blue-400 animate-pulse">{t("running")}</p>
          )}
        </div>
      </div>

      {scan.findings.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {t("findings", { count: scan.findings.length })}
            </h2>
            {activeFilter && (
              <button
                onClick={() => setActiveFilter(null)}
                className="text-xs text-gray-400 hover:text-white underline"
              >
                {t("clearFilter")}
              </button>
            )}
          </div>

          {/* Severity summary + filter */}
          <div className="flex flex-wrap gap-2">
            {SEVERITY_ORDER.filter((s) => countBySeverity[s] > 0).map((s) => (
              <button
                key={s}
                onClick={() => setActiveFilter(activeFilter === s ? null : s)}
                className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${
                  activeFilter === s
                    ? SEVERITY_BADGE_ACTIVE[s]
                    : SEVERITY_BADGE_INACTIVE[s]
                }`}
              >
                {s} · {countBySeverity[s]}
              </button>
            ))}
          </div>

          <ul className="space-y-3">
            {visible.map((f) => (
              <li key={f.id} className="rounded-xl border border-gray-800 p-4 space-y-2">
                <div className="flex items-start gap-3 justify-between">
                  <div className="space-y-1">
                    <span className="font-medium text-sm">{f.title}</span>
                    <div className="flex flex-wrap gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${SEVERITY_COLORS[f.severity]}`}>
                        {f.severity}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">
                        {OWASP_CATEGORIES[f.category]?.name ?? f.category}
                      </span>
                    </div>
                  </div>
                  {f.pointsLost > 0 && (
                    <span className="text-sm font-mono text-red-400 shrink-0">-{f.pointsLost} pts</span>
                  )}
                </div>
                <p className="text-sm text-gray-400">{f.description}</p>
                {f.evidence && (
                  <pre className="text-xs text-gray-500 bg-gray-900 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">
                    {f.evidence}
                  </pre>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
