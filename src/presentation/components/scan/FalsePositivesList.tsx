"use client";

import { useTranslations, useLocale } from "next-intl";
import type { FalsePositiveReport, FalsePositiveStatus } from "@/domain/entities/FalsePositiveReport";

const STATUS_STYLES: Record<FalsePositiveStatus, string> = {
  PENDING: "bg-yellow-900/30 text-yellow-400",
  APPROVED: "bg-emerald-900/30 text-emerald-400",
  REJECTED: "bg-red-900/30 text-red-400",
};

export function FalsePositivesList({ reports }: { reports: FalsePositiveReport[] }) {
  const t = useTranslations("scan.falsePositives");
  const locale = useLocale();

  if (reports.length === 0) {
    return (
      <p className="text-sm text-gray-500 py-4">{t("empty")}</p>
    );
  }

  return (
    <ul className="space-y-3">
      {reports.map((r) => (
        <li key={r.id} className="rounded-xl border border-gray-800 p-4 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-0.5 min-w-0">
              <p className="text-sm font-medium truncate">{r.title}</p>
              <p className="text-xs text-gray-500 truncate">{r.category.replace(/_/g, " ")}{r.filePath ? ` · ${r.filePath}` : ""}</p>
            </div>
            <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full ${STATUS_STYLES[r.status]}`}>
              {t(`status${r.status}` as Parameters<typeof t>[0])}
            </span>
          </div>
          <p className="text-xs text-gray-400 bg-gray-900 rounded p-2">{r.reason}</p>
          {r.adminNote && (
            <p className="text-xs text-gray-500">
              <span className="text-gray-400">{t("adminNote")}</span> {r.adminNote}
            </p>
          )}
          <p className="text-xs text-gray-600">
            {t("reportedOn", { date: new Date(r.createdAt).toLocaleDateString(locale) })}
          </p>
        </li>
      ))}
    </ul>
  );
}
