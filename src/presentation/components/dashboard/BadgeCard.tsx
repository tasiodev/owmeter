"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

function CopyButton({ text, label, copiedLabel }: { text: string; label: string; copiedLabel: string }) {
  const [copied, setCopied] = useState(false);
  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button
      onClick={handleCopy}
      className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors shrink-0 ${
        copied
          ? "bg-emerald-700 text-white"
          : "bg-gray-700 hover:bg-gray-600 text-gray-200"
      }`}
    >
      {copied ? copiedLabel : label}
    </button>
  );
}

export function BadgeCard({ projectId }: { projectId: string }) {
  const t = useTranslations("apiKey");

  const origin = typeof window !== "undefined" ? window.location.origin : "https://owaspchecker.app";
  const badgeUrl = `${origin}/api/badge/${projectId}`;
  const badgeMarkdown = `[![OWASP Score](${badgeUrl})](https://owaspchecker.app/dashboard/projects/${projectId})`;

  return (
    <div className="rounded-xl border border-gray-800 p-6 space-y-4">
      <div>
        <h2 className="text-base font-semibold text-white">{t("badgeTitle")}</h2>
        <p className="text-sm text-gray-400 mt-1">{t("badgeDescription")}</p>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={badgeUrl} alt="OWASP Score badge preview" className="h-5" />
      <div className="relative rounded-lg bg-gray-900 border border-gray-800 p-3">
        <code className="text-xs text-gray-300 font-mono break-all pr-16">{badgeMarkdown}</code>
        <div className="absolute top-2 right-2">
          <CopyButton text={badgeMarkdown} label={t("copy")} copiedLabel={t("copied")} />
        </div>
      </div>
    </div>
  );
}
