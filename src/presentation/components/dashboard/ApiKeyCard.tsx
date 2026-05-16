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

export function ApiKeyCard({
  projectId,
  initialApiKey,
}: {
  projectId: string;
  initialApiKey: string;
}) {
  const t = useTranslations("apiKey");
  const [apiKey, setApiKey] = useState(initialApiKey);
  const [regenerating, setRegenerating] = useState(false);

  async function handleRegenerate() {
    if (!window.confirm(t("regenerateConfirm"))) return;
    setRegenerating(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/api-key`, { method: "POST" });
      if (res.ok) {
        const data = await res.json() as { apiKey: string };
        setApiKey(data.apiKey);
      }
    } finally {
      setRegenerating(false);
    }
  }

  const ghActionsExample = `name: OWASP Scan
on:
  push:
    branches: [main]

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Owmeter scan
        run: |
          curl -s -X POST \\
            -H "Authorization: Bearer \${{ secrets.OWMETER_API_KEY }}" \\
            https://owmeter.app/api/projects/${projectId}/trigger-scan`;

  return (
    <div className="rounded-xl border border-gray-800 p-6 space-y-6">
      <div>
        <h2 className="text-base font-semibold text-white">{t("title")}</h2>
        <p className="text-sm text-gray-400 mt-1">{t("description")}</p>
      </div>

      {/* API Key row */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{t("keyLabel")}</p>
        <div className="flex items-center gap-2 bg-gray-900 rounded-lg px-3 py-2 border border-gray-800">
          <code className="flex-1 text-xs text-gray-300 font-mono break-all">{apiKey}</code>
          <CopyButton text={apiKey} label={t("copy")} copiedLabel={t("copied")} />
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className="text-xs px-2.5 py-1 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 disabled:opacity-50 transition-colors shrink-0"
          >
            {regenerating ? t("regenerating") : t("regenerate")}
          </button>
        </div>
      </div>

      {/* GitHub Actions example */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{t("exampleTitle")}</p>
        <div className="relative rounded-lg bg-gray-900 border border-gray-800 p-4">
          <pre className="text-xs text-gray-300 font-mono whitespace-pre overflow-x-auto">{ghActionsExample}</pre>
          <div className="absolute top-2 right-2">
            <CopyButton text={ghActionsExample} label={t("copy")} copiedLabel={t("copied")} />
          </div>
        </div>
        <p className="text-xs text-gray-500">
          Add <code className="text-gray-300">OWMETER_API_KEY</code> as a repository secret in GitHub → Settings → Secrets.
        </p>
      </div>
    </div>
  );
}
