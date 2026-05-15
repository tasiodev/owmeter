"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

interface Props {
  projectId: string;
  token: string;
}

export function VerifyRepoForm({ projectId, token }: Props) {
  const t = useTranslations("verifyRepo");
  const [repoUrl, setRepoUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/projects/${projectId}/verify-repo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl: repoUrl.trim() }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { message?: string };
        setError(data.message ?? t("failed"));
        return;
      }

      router.refresh();
    } catch {
      setError(t("networkError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-400">{t("instructions")}</p>
      <pre className="text-xs bg-gray-900 rounded-lg p-3 overflow-x-auto text-emerald-300 whitespace-pre-wrap break-all">
        {`owaspchecker-verify=${token}`}
      </pre>
      <p className="text-xs text-gray-500">{t("fileHint")}</p>
      <form onSubmit={handleVerify} className="space-y-2">
        <input
          type="url"
          placeholder="https://github.com/owner/repo"
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          required
          className="w-full px-4 py-2.5 rounded-lg bg-gray-900 border border-gray-700 focus:border-emerald-500 focus:outline-none text-sm placeholder-gray-500"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 rounded-lg border border-emerald-700 text-emerald-400 hover:bg-emerald-900/20 disabled:opacity-50 text-sm transition-colors"
        >
          {loading ? t("verifying") : t("verifyNow")}
        </button>
      </form>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
