"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { GitHubInstallation, GitHubRepo } from "@/domain/entities/GitHubInstallation";
import Link from "next/link";

interface Props {
  installation: GitHubInstallation | null;
}

export function GitHubAppConnectionCard({ installation }: Props) {
  const t = useTranslations("githubApp");
  const router = useRouter();

  const [repos, setRepos] = useState<GitHubRepo[] | null>(null);
  const [reposLoading, setReposLoading] = useState(false);
  const [reposError, setReposError] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  async function handleDisconnect() {
    if (!confirm(t("disconnectConfirm"))) return;
    setDisconnecting(true);
    try {
      await fetch("/api/github/app/disconnect", { method: "POST" });
      router.refresh();
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleLoadRepos() {
    setReposLoading(true);
    setReposError(null);
    try {
      const res = await fetch("/api/github/repos");
      if (!res.ok) throw new Error("fetch failed");
      const data = (await res.json()) as { repos: GitHubRepo[] };
      setRepos(data.repos);
    } catch {
      setReposError(t("reposError"));
    } finally {
      setReposLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-gray-800 p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold">{t("sectionTitle")}</h2>
          <p className="text-xs text-gray-500 mt-0.5">{t("sectionDesc")}</p>
        </div>
        {installation ? (
          <span className="shrink-0 text-xs bg-emerald-900/40 text-emerald-400 px-2 py-0.5 rounded-full">
            {t("connected")}
          </span>
        ) : (
          <span className="shrink-0 text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">
            {t("notConnected")}
          </span>
        )}
      </div>

      {/* Connected state */}
      {installation ? (
        <div className="space-y-4">
          <p className="text-sm text-gray-300">
            {t("connectedAs", { login: installation.targetLogin })}
            {installation.targetType === "Organization" && (
              <span className="ml-2 text-xs text-gray-500">(Organization)</span>
            )}
          </p>

          {/* Repo list toggle */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-gray-400">{t("reposTitle")}</span>
              {!repos && (
                <button
                  onClick={handleLoadRepos}
                  disabled={reposLoading}
                  className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors disabled:opacity-50"
                >
                  {reposLoading ? t("reposLoading") : t("loadRepos")}
                </button>
              )}
            </div>

            {reposError && (
              <p className="text-xs text-red-400">{reposError}</p>
            )}

            {repos !== null && (
              repos.length === 0 ? (
                <p className="text-xs text-gray-500">{t("reposEmpty")}</p>
              ) : (
                <ul className="space-y-1 max-h-48 overflow-y-auto">
                  {repos.map((r) => (
                    <li key={r.fullName} className="flex items-center gap-2 text-xs text-gray-300">
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
                      </svg>
                      <span className="flex-1 truncate">{r.fullName}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${r.private ? "bg-gray-700 text-gray-400" : "bg-blue-900/30 text-blue-400"}`}>
                        {r.private ? t("privateLabel") : t("publicLabel")}
                      </span>
                    </li>
                  ))}
                </ul>
              )
            )}
          </div>

          <button
            onClick={handleDisconnect}
            disabled={disconnecting}
            className="text-xs px-3 py-1.5 rounded-lg border border-red-800 text-red-400 hover:bg-red-900/20 disabled:opacity-50 transition-colors"
          >
            {disconnecting ? t("disconnecting") : t("disconnectBtn")}
          </button>
        </div>
      ) : (
        /* Not connected state */
        <div className="space-y-4">
          <div className="text-xs text-gray-500 space-y-1.5">
            <p className="font-medium text-gray-400">{t("howItWorks")}</p>
            <p>1. {t("step1")}</p>
            <p>2. {t("step2")}</p>
            <p>3. {t("step3")}</p>
          </div>

          <p className="text-xs text-gray-600 border-l-2 border-gray-700 pl-2 italic">
            🔒 {t("securityNote")}
          </p>

          <Link
            href="/api/github/app/install"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-sm transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
            {t("connectBtn")}
          </Link>
        </div>
      )}
    </div>
  );
}
