"use client";

import { useEffect, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import type { Scan, Finding } from "@/domain/entities/Scan";
import type { Severity } from "@/domain/value-objects/Severity";
import { OWASP_CATEGORIES } from "@/domain/value-objects/OWASPCategory";
import { generateFindingPrompt, generateAllFindingsPrompt } from "./promptGenerators";

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

function RobotIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="11" width="18" height="10" rx="2" />
      <circle cx="12" cy="5" r="2" />
      <line x1="12" y1="7" x2="12" y2="11" />
      <line x1="8" y1="15" x2="8" y2="17" />
      <line x1="16" y1="15" x2="16" y2="17" />
      <circle cx="8" cy="15" r="1" fill="currentColor" stroke="none" />
      <circle cx="16" cy="15" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function PromptIAModal({
  prompt,
  onClose,
  t,
}: {
  prompt: string;
  onClose: () => void;
  t: ReturnType<typeof useTranslations<"scan">>;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl rounded-xl border border-gray-700 bg-gray-950 shadow-2xl flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <RobotIcon />
            <span className="font-semibold text-sm">{t("prompt.modalTitle")}</span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-200 transition-colors text-lg leading-none"
            aria-label={t("prompt.close")}
          >
            ×
          </button>
        </div>
        <p className="px-5 pt-3 pb-1 text-xs text-gray-500">{t("prompt.modalSubtitle")}</p>
        <pre className="flex-1 overflow-y-auto mx-5 my-3 text-xs text-gray-300 bg-gray-900 rounded-lg p-4 whitespace-pre-wrap break-words font-mono">
          {prompt}
        </pre>
        <div className="px-5 pb-4 flex justify-end">
          <button
            onClick={handleCopy}
            className={`text-sm px-4 py-2 rounded-lg font-medium transition-colors ${
              copied
                ? "bg-emerald-700 text-white"
                : "bg-violet-600 hover:bg-violet-500 text-white"
            }`}
          >
            {copied ? t("prompt.copied") : t("prompt.copy")}
          </button>
        </div>
      </div>
    </div>
  );
}

function PromptIAButton({
  getText,
  t,
}: {
  getText: () => string;
  t: ReturnType<typeof useTranslations<"scan">>;
}) {
  const [open, setOpen] = useState(false);
  const prompt = open ? getText() : "";

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border border-gray-700 text-gray-400 hover:border-violet-500 hover:text-violet-300 transition-colors"
      >
        <RobotIcon />
        {t("prompt.buttonLabel")}
      </button>
      {open && (
        <PromptIAModal
          prompt={prompt}
          onClose={() => setOpen(false)}
          t={t}
        />
      )}
    </>
  );
}

function FindingCard({ finding, t }: { finding: Finding; t: ReturnType<typeof useTranslations<"scan">> }) {
  return (
    <li className="rounded-xl border border-gray-800 p-4 space-y-2">
      <div className="flex items-start gap-3 justify-between">
        <div className="space-y-1">
          <span className="font-medium text-sm">{finding.title}</span>
          <div className="flex flex-wrap gap-2">
            <span className={`text-xs px-2 py-0.5 rounded-full ${SEVERITY_COLORS[finding.severity]}`}>
              {finding.severity}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">
              {OWASP_CATEGORIES[finding.category]?.name ?? finding.category}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {finding.pointsLost > 0 && (
            <span className="text-sm font-mono text-red-400">-{finding.pointsLost} pts</span>
          )}
          <PromptIAButton getText={() => generateFindingPrompt(finding)} t={t} />
        </div>
      </div>
      <p className="text-sm text-gray-400">{finding.description}</p>
      {finding.evidence && (
        <pre className="text-xs text-gray-500 bg-gray-900 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">
          {finding.evidence}
        </pre>
      )}
    </li>
  );
}

export function ScanResult({ scan, domain }: { scan: Scan; domain?: string }) {
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
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold">
              {t("findings", { count: scan.findings.length })}
            </h2>
            <div className="flex items-center gap-3">
              <PromptIAButton getText={() => generateAllFindingsPrompt(scan.findings, domain)} t={t} />
              {activeFilter && (
                <button
                  onClick={() => setActiveFilter(null)}
                  className="text-xs text-gray-400 hover:text-white underline"
                >
                  {t("clearFilter")}
                </button>
              )}
            </div>
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
              <FindingCard key={f.id} finding={f} t={t} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
