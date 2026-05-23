"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import type { FalsePositiveReport } from "@/domain/entities/FalsePositiveReport";

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-yellow-900/30 text-yellow-400",
  APPROVED: "bg-emerald-900/30 text-emerald-400",
  REJECTED: "bg-red-900/30 text-red-400",
};

function ReviewRow({ report }: { report: FalsePositiveReport & { projectName?: string; reporterEmail?: string } }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(status: "APPROVED" | "REJECTED") {
    setBusy(true);
    await fetch(`/api/admin/false-positives/${report.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, adminNote: note.trim() || undefined }),
    });
    router.refresh();
  }

  return (
    <li className="rounded-xl border border-gray-800 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5 min-w-0">
          <p className="text-sm font-medium truncate">{report.title}</p>
          <p className="text-xs text-gray-500 truncate">
            {report.category.replace(/_/g, " ")}
            {report.filePath ? ` · ${report.filePath}` : ""}
          </p>
          {report.projectName && <p className="text-xs text-gray-600 truncate">Project: {report.projectName}</p>}
          {report.reporterEmail && <p className="text-xs text-gray-600 truncate">Reporter: {report.reporterEmail}</p>}
        </div>
        <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full ${STATUS_STYLES[report.status]}`}>
          {report.status}
        </span>
      </div>

      {report.evidence && (
        <pre className="text-xs text-gray-500 bg-gray-900 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">
          {report.evidence}
        </pre>
      )}

      <div className="rounded-lg bg-gray-900/60 px-3 py-2">
        <p className="text-xs text-gray-400 font-medium mb-1">User reason:</p>
        <p className="text-sm text-gray-300">{report.reason}</p>
      </div>

      <div className="space-y-2 pt-1">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional note to the user…"
          rows={2}
          className="w-full rounded-lg bg-gray-900 border border-gray-700 focus:border-gray-500 outline-none px-3 py-2 text-sm text-gray-200 placeholder-gray-600 resize-none"
        />
        <div className="flex gap-2">
          {report.status !== "APPROVED" && (
            <button
              onClick={() => submit("APPROVED")}
              disabled={busy}
              className="text-sm px-4 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 transition-colors font-medium"
            >
              Approve
            </button>
          )}
          {report.status !== "REJECTED" && (
            <button
              onClick={() => submit("REJECTED")}
              disabled={busy}
              className="text-sm px-4 py-1.5 rounded-lg bg-red-800 hover:bg-red-700 disabled:opacity-50 transition-colors font-medium"
            >
              Reject
            </button>
          )}
        </div>
      </div>

      {report.adminNote && (
        <p className="text-xs text-gray-500"><span className="text-gray-400">Admin note:</span> {report.adminNote}</p>
      )}
    </li>
  );
}

export function AdminFalsePositivesList({ reports }: { reports: (FalsePositiveReport & { projectName?: string; reporterEmail?: string })[] }) {
  const pending = reports.filter((r) => r.status === "PENDING");
  const reviewed = reports.filter((r) => r.status !== "PENDING");

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-base font-semibold">Pending review ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className="text-sm text-gray-500">No pending reports.</p>
        ) : (
          <ul className="space-y-3">{pending.map((r) => <ReviewRow key={r.id} report={r} />)}</ul>
        )}
      </section>

      {reviewed.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-gray-500">Reviewed ({reviewed.length})</h2>
          <ul className="space-y-3">{reviewed.map((r) => <ReviewRow key={r.id} report={r} />)}</ul>
        </section>
      )}
    </div>
  );
}
