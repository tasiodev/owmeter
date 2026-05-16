"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

interface Props {
  projectId: string;
  initialIsPublic: boolean;
}

export function PrivacyToggle({ projectId, initialIsPublic }: Props) {
  const t = useTranslations("privacy");
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(checked: boolean) {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic: checked }),
      });
      if (!res.ok) { setError(t("saveError")); return; }
      setIsPublic(checked);
    } catch {
      setError(t("saveError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-gray-800 p-4 space-y-3">
      <h2 className="text-sm font-semibold">{t("sectionTitle")}</h2>
      <label className="flex items-start gap-3 cursor-pointer group">
        <div className="relative mt-0.5 shrink-0">
          <input
            type="checkbox"
            checked={isPublic}
            disabled={saving}
            onChange={(e) => handleChange(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-10 h-6 rounded-full bg-gray-700 peer-checked:bg-emerald-600 transition-colors peer-disabled:opacity-50" />
          <div className="absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform peer-checked:translate-x-4" />
        </div>
        <div className="space-y-0.5">
          <p className="text-sm text-gray-200 group-hover:text-white transition-colors">
            {t("isPublicLabel")}
          </p>
          <p className="text-xs text-gray-500">{t("isPublicHint")}</p>
        </div>
      </label>
      {saving && <p className="text-xs text-gray-500">{t("saving")}</p>}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
