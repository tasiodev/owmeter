"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import type { GitHubRepo } from "@/domain/entities/GitHubInstallation";

interface Props {
  projectId: string;
  token: string;
  /** True if the GitHub App env vars are configured on this server */
  gitHubAppEnabled: boolean;
  /** True if this user has already connected their GitHub App installation */
  hasGitHubApp: boolean;
}

type Tab = "public" | "private";

export function VerifyRepoForm({ projectId, token, gitHubAppEnabled, hasGitHubApp }: Props) {
  const t = useTranslations("verifyRepo");
  const tp = useTranslations("verifyRepoPrivate");
  const router = useRouter();

  // Tab state
  const [tab, setTab] = useState<Tab>("public");

  // Public repo state
  const [repoUrl, setRepoUrl] = useState("");
  const [publicLoading, setPublicLoading] = useState(false);
  const [publicError, setPublicError] = useState<string | null>(null);

  // Private repo state
  const [repos, setRepos] = useState<GitHubRepo[] | null>(null);
  const [reposLoading, setReposLoading] = useState(false);
  const [reposError, setReposError] = useState<string | null>(null);
  const [selectedRepo, setSelectedRepo] = useState("");
  const [privateLoading, setPrivateLoading] = useState(false);
  const [privateError, setPrivateError] = useState<string | null>(null);

  // ── Public repo verify ────────────────────────────────────────────────────
  async function handlePublicVerify(e: React.FormEvent) {
    e.preventDefault();
    setPublicError(null);
    setPublicLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/verify-repo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl: repoUrl.trim() }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { message?: string };
        setPublicError(data.message ?? t("failed"));
        return;
      }
      router.refresh();
    } catch {
      setPublicError(t("networkError"));
    } finally {
      setPublicLoading(false);
    }
  }

  // ── Load private repos ────────────────────────────────────────────────────
  async function loadRepos() {
    if (repos !== null) return; // already loaded
    setReposLoading(true);
    setReposError(null);
    try {
      const res = await fetch("/api/github/repos");
      if (!res.ok) throw new Error("fetch failed");
      const data = (await res.json()) as { repos: GitHubRepo[] };
      setRepos(data.repos);
      if (data.repos.length > 0) setSelectedRepo(data.repos[0].fullName);
    } catch {
      setReposError(tp("networkError"));
    } finally {
      setReposLoading(false);
    }
  }

  function handleTabChange(next: Tab) {
    setTab(next);
    if (next === "private" && hasGitHubApp) {
      loadRepos();
    }
  }

  // ── Link private repo ────────────────────────────────────────────────────
  async function handlePrivateLink(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedRepo) return;
    setPrivateError(null);
    setPrivateLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/connect-private-repo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoFullName: selectedRepo }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { message?: string };
        setPrivateError(data.message ?? tp("failed"));
        return;
      }
      router.refresh();
    } catch {
      setPrivateError(tp("networkError"));
    } finally {
      setPrivateLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Tab switcher — only show private tab if GitHub App is configured on this server */}
      {gitHubAppEnabled && (
        <div className="flex gap-1 p-1 bg-gray-900 rounded-lg w-fit">
          <button
            type="button"
            onClick={() => handleTabChange("public")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              tab === "public"
                ? "bg-gray-700 text-white"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            {tp("tabPublic")}
          </button>
          <button
            type="button"
            onClick={() => handleTabChange("private")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              tab === "private"
                ? "bg-gray-700 text-white"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            {tp("tabPrivate")}
          </button>
        </div>
      )}

      {/* ── Public tab ── */}
      {tab === "public" && (
        <div className="space-y-4">
          <p className="text-sm text-gray-400">{t("instructions")}</p>
          <pre className="text-xs bg-gray-900 rounded-lg p-3 overflow-x-auto text-emerald-300 whitespace-pre-wrap break-all">
            {`owmeter-verify=${token}`}
          </pre>
          <p className="text-xs text-gray-500">{t("fileHint")}</p>
          <form onSubmit={handlePublicVerify} className="space-y-2">
            <input
              type="url"
              placeholder="https://github.com/owner/repo  or  gitlab.com/…  or  bitbucket.org/…"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              required
              className="w-full px-4 py-2.5 rounded-lg bg-gray-900 border border-gray-700 focus:border-emerald-500 focus:outline-none text-sm placeholder-gray-500"
            />
            <button
              type="submit"
              disabled={publicLoading}
              className="px-4 py-2 rounded-lg border border-emerald-700 text-emerald-400 hover:bg-emerald-900/20 disabled:opacity-50 text-sm transition-colors"
            >
              {publicLoading ? t("verifying") : t("verifyNow")}
            </button>
          </form>
          {publicError && <p className="text-sm text-red-400">{publicError}</p>}
        </div>
      )}

      {/* ── Private tab ── */}
      {tab === "private" && (
        <div className="space-y-4">
          {!hasGitHubApp ? (
            /* No GitHub App connected */
            <div className="rounded-lg border border-dashed border-gray-700 p-4 space-y-2 text-center">
              <p className="text-sm font-medium text-gray-300">{tp("noAppTitle")}</p>
              <p className="text-xs text-gray-500">{tp("noAppDesc")}</p>
              <a
                href="../settings"
                className="inline-block text-xs text-emerald-400 hover:text-emerald-300 transition-colors mt-1"
              >
                {tp("goToSettings")}
              </a>
            </div>
          ) : reposLoading ? (
            <p className="text-sm text-gray-500">{tp("loadRepos")}…</p>
          ) : reposError ? (
            <p className="text-sm text-red-400">{reposError}</p>
          ) : repos !== null ? (
            repos.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-700 p-4 text-center">
                <p className="text-xs text-gray-500">{tp("selectRepoPlaceholder")}</p>
              </div>
            ) : (
              <form onSubmit={handlePrivateLink} className="space-y-3">
                <label className="block text-xs text-gray-400 font-medium">
                  {tp("selectRepo")}
                </label>
                <select
                  value={selectedRepo}
                  onChange={(e) => setSelectedRepo(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-gray-900 border border-gray-700 focus:border-emerald-500 focus:outline-none text-sm text-gray-200"
                >
                  {repos.map((r) => (
                    <option key={r.fullName} value={r.fullName}>
                      {r.fullName} {r.private ? "🔒" : ""}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={privateLoading || !selectedRepo}
                  className="px-4 py-2 rounded-lg border border-emerald-700 text-emerald-400 hover:bg-emerald-900/20 disabled:opacity-50 text-sm transition-colors"
                >
                  {privateLoading ? tp("linking") : tp("linkBtn")}
                </button>
                {privateError && (
                  <p className="text-sm text-red-400">{privateError}</p>
                )}
              </form>
            )
          ) : null}
        </div>
      )}
    </div>
  );
}
