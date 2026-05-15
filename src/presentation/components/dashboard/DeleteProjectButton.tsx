"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

export function DeleteProjectButton({ projectId }: { projectId: string }) {
  const t = useTranslations("site");
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        setError(t("deleteError"));
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError(t("deleteError"));
      setConfirming(false);
    } finally {
      setLoading(false);
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-400">{t("deleteConfirm")}</span>
        <button
          onClick={handleDelete}
          disabled={loading}
          className="text-sm px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white transition-colors"
        >
          {loading ? t("deleting") : t("deleteYes")}
        </button>
        <button
          onClick={() => setConfirming(false)}
          disabled={loading}
          className="text-sm px-3 py-1.5 rounded-lg border border-gray-700 hover:border-gray-500 text-gray-400 hover:text-white transition-colors"
        >
          {t("deleteNo")}
        </button>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="text-sm text-red-500 hover:text-red-400 transition-colors"
    >
      {t("deleteProject")}
    </button>
  );
}
