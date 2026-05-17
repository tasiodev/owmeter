"use client";

import { useEffect, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations, useLocale } from "next-intl";
import type { Scan, Finding } from "@/domain/entities/Scan";
import type { Severity } from "@/domain/value-objects/Severity";
import { OWASP_CATEGORIES, evaluationLevel, PASSIVE_UNEVALUATED, CODE_UNEVALUATED } from "@/domain/value-objects/OWASPCategory";
import type { OWASPCategoryId, ScanMode } from "@/domain/value-objects/OWASPCategory";
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
  const pct = maxScore > 0 ? score / maxScore : 0;
  const pctRounded = Math.round(pct * 100);
  const strokeColor =
    pctRounded >= 80 ? "#34d399" : pctRounded >= 50 ? "#facc15" : "#f87171";

  const size = 112;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference * pct;

  return (
    <div className="relative shrink-0 w-28 h-28">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#1f2937"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          style={{ transition: "stroke-dasharray 0.6s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold" style={{ color: strokeColor }}>
          {score}
        </span>
        <span className="text-xs text-gray-500">/ {maxScore}</span>
      </div>
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

const SCAN_TYPE_STYLES: Record<string, string> = {
  FULL: "bg-violet-900/40 text-violet-300",
  CODE: "bg-blue-900/40 text-blue-300",
  PASSIVE: "bg-gray-800 text-gray-400",
};

function ScanTypeBadge({
  type,
  t,
}: {
  type: string;
  t: ReturnType<typeof useTranslations<"scan">>;
}) {
  const badgeKey = `scanType${type}Badge` as Parameters<typeof t>[0];
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${SCAN_TYPE_STYLES[type] ?? "bg-gray-800 text-gray-400"}`}>
      {t(badgeKey)}
    </span>
  );
}

const GITHUB_ISSUES_URL = `${process.env.NEXT_PUBLIC_GITHUB_URL ?? ""}/issues`;

function FalsePositiveHint({ t }: { t: ReturnType<typeof useTranslations<"scan">> }) {
  return (
    <div className="flex gap-3 rounded-xl border border-gray-800 bg-gray-900/40 px-4 py-3">
      <svg className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <p className="text-xs text-gray-500 leading-relaxed">
        {t("falsePositiveHint")}{" "}
        <a
          href={GITHUB_ISSUES_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-400 underline underline-offset-2 hover:text-gray-200 transition-colors"
        >
          {t("falsePositiveLink")} →
        </a>
      </p>
    </div>
  );
}

const EVIDENCE_TRUNCATE_LIMIT = 300;

function EvidenceBlock({ evidence }: { evidence: string }) {
  const [expanded, setExpanded] = useState(false);
  const long = evidence.length > EVIDENCE_TRUNCATE_LIMIT;
  const displayed = long && !expanded ? evidence.slice(0, EVIDENCE_TRUNCATE_LIMIT) + "…" : evidence;

  return (
    <div className="space-y-1">
      <pre className="text-xs text-gray-500 bg-gray-900 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">
        {displayed}
      </pre>
      {long && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
        >
          {expanded ? "Show less" : `Show ${evidence.length - EVIDENCE_TRUNCATE_LIMIT} more chars`}
        </button>
      )}
    </div>
  );
}

function FindingCard({ finding, t }: { finding: Finding; t: ReturnType<typeof useTranslations<"scan">> }) {
  return (
    <li id={`finding-${finding.id}`} className="rounded-xl border border-gray-800 p-4 space-y-2">
      <div className="flex items-start gap-3 justify-between">
        <div className="space-y-1">
          <span className="font-medium text-sm">{finding.title}</span>
          <div className="flex flex-wrap gap-2">
            <span className={`text-xs px-2 py-0.5 rounded-full ${SEVERITY_COLORS[finding.severity]}`}>
              {finding.severity}
            </span>
            {(() => {
              const cat = OWASP_CATEGORIES[finding.category];
              return cat ? (
                <a
                  href={cat.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-700 transition-colors"
                >
                  {cat.name}
                </a>
              ) : (
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">
                  {finding.category}
                </span>
              );
            })()}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <PromptIAButton getText={() => generateFindingPrompt(finding)} t={t} />
        </div>
      </div>
      <p className="text-sm text-gray-400">{finding.description}</p>
      {finding.evidence && <EvidenceBlock evidence={finding.evidence} />}
    </li>
  );
}

function CategoryIcon({ state }: { state: "ok" | "warn" | "partial" | "na" }) {
  if (state === "ok")
    return (
      <svg className="w-4 h-4 text-emerald-400 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
      </svg>
    );
  if (state === "warn")
    return (
      <svg className="w-4 h-4 text-amber-400 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
      </svg>
    );
  if (state === "partial")
    // dashed circle + checkmark: "evaluated but not fully"
    return (
      <svg className="w-4 h-4 text-blue-300/70 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" strokeDasharray="3 2" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    );
  // na
  return (
    <svg className="w-4 h-4 text-gray-600 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M4 10a.75.75 0 0 1 .75-.75h10.5a.75.75 0 0 1 0 1.5H4.75A.75.75 0 0 1 4 10Z" clipRule="evenodd" />
    </svg>
  );
}

function CategoryBreakdownSection({
  scan,
  t,
}: {
  scan: Scan;
  t: ReturnType<typeof useTranslations<"scan">>;
}) {
  const [expandedId, setExpandedId] = useState<OWASPCategoryId | null>(null);

  const lostByCategory: Partial<Record<OWASPCategoryId, number>> = {};
  const findingsByCategory: Partial<Record<OWASPCategoryId, Finding[]>> = {};
  for (const f of scan.findings) {
    lostByCategory[f.category] = (lostByCategory[f.category] ?? 0) + f.pointsLost;
    if (!findingsByCategory[f.category]) findingsByCategory[f.category] = [];
    findingsByCategory[f.category]!.push(f);
  }

  const STATE_ORDER = { warn: 0, ok: 1, partial: 2, na: 3 };

  const entries = (
    Object.entries(OWASP_CATEGORIES) as [OWASPCategoryId, (typeof OWASP_CATEGORIES)[OWASPCategoryId]][]
  )
    .map(([id, cat]) => {
      const level = evaluationLevel(id, scan.type as ScanMode);
      const lost = lostByCategory[id] ?? 0;
      const hasFindings = level !== "none" && lost > 0;
      const state: "ok" | "warn" | "partial" | "na" =
        level === "none" ? "na" :
        hasFindings ? "warn" :
        level === "partial" ? "partial" :
        "ok";
      const categoryFindings = findingsByCategory[id] ?? [];
      return { id, cat, lost, hasFindings, state, categoryFindings };
    })
    .sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state]);

  function scrollToFinding(findingId: string) {
    const el = document.getElementById(`finding-${findingId}`);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 96;
    window.scrollTo({ top, behavior: "smooth" });
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">{t("categoryBreakdown")}</h2>
      <ul className="rounded-xl border border-gray-800 divide-y divide-gray-800 overflow-hidden">
        {entries.map(({ id, cat, lost, state, categoryFindings }) => {
          const naReason = PASSIVE_UNEVALUATED.has(id)
            ? t("notEvaluatedDesc")
            : CODE_UNEVALUATED.has(id)
            ? t("notEvaluatedServerDesc")
            : null;

          const isExpanded = expandedId === id;
          const canExpand = categoryFindings.length > 0;

          return (
            <li key={id}>
              <div
                className={`flex items-center gap-3 px-4 py-2.5 text-sm ${canExpand ? "cursor-pointer hover:bg-gray-800/40" : ""}`}
                onClick={canExpand ? () => setExpandedId(isExpanded ? null : id) : undefined}
              >
                <CategoryIcon state={state} />
                <div className="flex-1 min-w-0">
                  <span className={state === "na" ? "text-gray-500" : "text-gray-200"}>
                    {cat.name}
                  </span>
                  <a
                    href={cat.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center ml-1.5 text-blue-500 hover:text-blue-300 transition-colors align-middle"
                    aria-label={cat.name}
                  >
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M7 17L17 7" />
                      <path d="M7 7h10v10" />
                    </svg>
                  </a>
                  {state === "na" && naReason && (
                    <p className="text-xs text-gray-600 mt-0.5">{naReason}</p>
                  )}
                  {state === "partial" && (
                    <p className="text-xs text-blue-300/70 mt-0.5">
                      {t((`partialNotes.${scan.type}_${id}`) as Parameters<typeof t>[0])}
                    </p>
                  )}
                </div>
                {state === "na" && (
                  <span className="text-xs text-gray-600 shrink-0">{t("notEvaluatedLabel")}</span>
                )}
                {state === "partial" && (
                  <span className="text-xs text-blue-300/70 shrink-0">{t("partialEvaluatedLabel")}</span>
                )}
                {state === "warn" && (
                  <span className="text-xs font-mono text-amber-400 shrink-0">-{Math.min(lost, cat.maxPoints)} pts</span>
                )}
                {state === "ok" && (
                  <span className="text-xs text-emerald-600 shrink-0">{t("validatedLabel")}</span>
                )}
                {canExpand && (
                  <svg
                    className={`w-3.5 h-3.5 text-gray-500 shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                )}
              </div>
              {isExpanded && (
                <ul className="px-11 pb-3 pt-1 space-y-0.5 bg-gray-900/30">
                  {categoryFindings.map((f) => (
                    <li key={f.id}>
                      <button
                        onClick={() => scrollToFinding(f.id)}
                        className="cursor-pointer text-xs text-gray-400 hover:text-gray-100 text-left w-full py-1 transition-colors flex items-center gap-2"
                      >
                        <span className="text-gray-600 shrink-0">›</span>
                        {f.title}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function ScanResult({ scan, domain, projectId, repoVerified }: { scan: Scan; domain?: string; projectId?: string; repoVerified?: boolean }) {
  const t = useTranslations("scan");
  const locale = useLocale();
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<Severity | null>(null);

  useEffect(() => {
    if (scan.status !== "PENDING" && scan.status !== "RUNNING") return;
    const interval = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(interval);
  }, [scan.status, router]);

  if (scan.status === "FAILED") {
    return (
      <div className="rounded-xl border border-red-800 bg-red-950/30 p-6 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-0.5 rounded-full bg-red-900/60 text-red-400">FAILED</span>
          <ScanTypeBadge type={scan.type} t={t} />
        </div>
        <h2 className="font-semibold text-red-300">{t("failedTitle")}</h2>
        <p className="text-sm text-gray-400">{t("failedDesc")}</p>
        {scan.errorMessage && (
          <div className="space-y-1">
            <p className="text-xs text-gray-500">{t("failedErrorLabel")}</p>
            <pre className="text-xs text-red-400/80 bg-gray-900 rounded p-2 whitespace-pre-wrap break-all">
              {scan.errorMessage}
            </pre>
          </div>
        )}
      </div>
    );
  }

  if (scan.status === "INVALID") {
    return (
      <div className="rounded-xl border border-red-800 bg-red-950/30 p-6 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-0.5 rounded-full bg-red-900/60 text-red-400">INVALID</span>
          <ScanTypeBadge type={scan.type} t={t} />
        </div>
        <h2 className="font-semibold text-red-300">{t("invalidTitle")}</h2>
        <p className="text-sm text-gray-400">{t("invalidDesc")}</p>
        {scan.errorMessage && (
          <div className="space-y-1">
            <p className="text-xs text-gray-500">{t("invalidErrorLabel")}</p>
            <pre className="text-xs text-gray-500 bg-gray-900 rounded p-2 whitespace-pre-wrap break-all">
              {scan.errorMessage}
            </pre>
          </div>
        )}
      </div>
    );
  }

  const statusBadge: Record<string, string> = {
    PENDING: "bg-gray-800 text-gray-400",
    RUNNING: "bg-blue-900/40 text-blue-400",
    COMPLETED: "bg-emerald-900/40 text-emerald-400",
    FAILED: "bg-red-900/40 text-red-400",
    INVALID: "bg-red-900/60 text-red-400",
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
      <div className="rounded-xl border border-gray-800 overflow-hidden">
        <div className="p-6 flex items-center gap-6">
          {scan.score !== null && scan.maxScore !== null ? (
            <ScoreCircle score={scan.score} maxScore={scan.maxScore} />
          ) : (
            <div className="relative shrink-0 w-28 h-28">
              <svg width={112} height={112} className="-rotate-90">
                <circle cx={56} cy={56} r={52} fill="none" stroke="#1f2937" strokeWidth={8} />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-gray-500 text-sm">—</span>
              </div>
            </div>
          )}
          <div className="space-y-1">
            <div className="flex items-center flex-wrap gap-2">
              {scan.status !== "COMPLETED" && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${statusBadge[scan.status]}`}>
                  {scan.status}
                </span>
              )}
              <ScanTypeBadge type={scan.type} t={t} />
              {(scan.type === "FULL" || scan.type === "CODE") && repoVerified === false && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-900/40 text-amber-400" title={t("unverifiedSourceDesc")}>
                  {t("unverifiedSourceBadge")}
                </span>
              )}
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

        {scan.status === "COMPLETED" && projectId && (
          <a
            href={`/api/projects/${projectId}/scans/${scan.id}/certificate?locale=${locale}`}
            download
            className="flex items-center gap-4 px-6 py-4 border-t border-gray-800 bg-emerald-950/20 hover:bg-emerald-950/40 transition-colors group"
          >
            <div className="shrink-0 w-9 h-9 rounded-lg bg-emerald-900/40 group-hover:bg-emerald-900/60 transition-colors flex items-center justify-center">
              <svg className="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="12" y1="18" x2="12" y2="12" />
                <polyline points="9 15 12 18 15 15" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-emerald-400 group-hover:text-emerald-300 transition-colors">
                {t("certificate")}
              </p>
              <p className="text-xs text-emerald-700 group-hover:text-emerald-600 transition-colors">
                {t("certificateSub")}
              </p>
            </div>
            <svg className="w-4 h-4 text-emerald-700 group-hover:text-emerald-500 transition-colors shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 16V4" />
              <path d="M8 12l4 4 4-4" />
              <path d="M20 20H4" />
            </svg>
          </a>
        )}
      </div>

      {scan.status === "COMPLETED" && (
        <CategoryBreakdownSection scan={scan} t={t} />
      )}

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

          <FalsePositiveHint t={t} />
        </div>
      )}
    </div>
  );
}
