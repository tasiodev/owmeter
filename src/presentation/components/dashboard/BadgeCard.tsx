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
  const [lang, setLang] = useState<"en" | "es">("en");

  const origin = typeof window !== "undefined" ? window.location.origin : "https://owaspchecker.app";
  const badgeUrl = `${origin}/api/badge/${projectId}?lang=${lang}`;
  const badgeMarkdown = `![OWASP Score](${badgeUrl})`;

  return (
    <div className="rounded-xl border border-gray-800 p-6 space-y-4">
      <div>
        <h2 className="text-base font-semibold text-white">{t("badgeTitle")}</h2>
        <p className="text-sm text-gray-400 mt-1">{t("badgeDescription")}</p>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-500">{t("badgeLang")}</span>
        <div className="flex rounded-lg overflow-hidden border border-gray-700">
          {(["en", "es"] as const).map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={`px-3 py-1 text-xs font-medium transition-colors ${
                lang === l
                  ? "bg-emerald-700 text-white"
                  : "bg-gray-800 text-gray-400 hover:text-gray-200"
              }`}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img key={badgeUrl} src={badgeUrl} alt="OWASP Score badge preview" className="h-10" />

      <div className="relative rounded-lg bg-gray-900 border border-gray-800 p-3">
        <code className="text-xs text-gray-300 font-mono break-all pr-16">{badgeMarkdown}</code>
        <div className="absolute top-2 right-2">
          <CopyButton text={badgeMarkdown} label={t("copy")} copiedLabel={t("copied")} />
        </div>
      </div>
    </div>
  );
}
