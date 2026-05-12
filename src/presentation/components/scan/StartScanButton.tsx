"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

export function StartScanButton({
  websiteId,
  redirectTo,
}: {
  websiteId: string;
  redirectTo?: string;
}) {
  const t = useTranslations("scan");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleStart() {
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/scans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteId }),
      });

      if (!res.ok) {
        const { error: code } = await res.json();
        setError(code === "NOT_VERIFIED" ? t("notVerified") : t("networkError"));
        return;
      }

      if (redirectTo) {
        router.push(redirectTo);
      } else {
        router.refresh();
      }
    } catch {
      setError(t("networkError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-1">
      <button
        onClick={handleStart}
        disabled={loading}
        className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-sm font-medium transition-colors"
      >
        {loading ? t("starting") : t("startScan")}
      </button>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
