"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations, useLocale } from "next-intl";

interface Props {
  websiteId: string;
  method: "DNS_TXT" | "META_TAG" | "FILE";
}

export function VerifyForm({ websiteId, method }: Props) {
  const t = useTranslations("verify");
  const locale = useLocale();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleVerify() {
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/websites/${websiteId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method }),
      });

      if (!res.ok) {
        setError(t("failed"));
        return;
      }

      router.push(`/dashboard/websites/${websiteId}`, { locale });
      router.refresh();
    } catch {
      setError(t("networkError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handleVerify}
        disabled={loading}
        className="px-4 py-2 rounded-lg border border-emerald-700 text-emerald-400 hover:bg-emerald-900/20 disabled:opacity-50 text-sm transition-colors"
      >
        {loading ? t("verifying") : t("verifyNow")}
      </button>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
