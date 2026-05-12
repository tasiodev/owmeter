"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

export function AddWebsiteForm() {
  const t = useTranslations("dashboard");
  const [domain, setDomain] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/websites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: domain.trim().toLowerCase() }),
      });

      if (!res.ok) {
        const { error: code } = await res.json();
        if (code === "DOMAIN_ALREADY_IN_LIST") setError(t("domainAlreadyInList"));
        else if (code === "DOMAIN_CLAIMED_BY_OTHER") setError(t("domainClaimedByOther"));
        else setError(t("networkError"));
        return;
      }

      setDomain("");
      router.refresh();
    } catch {
      setError(t("networkError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder={t("domainPlaceholder")}
          pattern="[a-zA-Z0-9][a-zA-Z0-9\-\.]*[a-zA-Z0-9]"
          required
          className="flex-1 px-4 py-2.5 rounded-lg bg-gray-900 border border-gray-700 focus:border-emerald-500 focus:outline-none text-sm placeholder-gray-500"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-sm font-medium transition-colors"
        >
          {loading ? t("adding") : t("addDomain")}
        </button>
      </form>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
