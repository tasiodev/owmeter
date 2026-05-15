"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import type { ProjectType } from "@/domain/entities/Project";

type ScanType = "PASSIVE" | "FULL" | "CODE";

export function ScanTypeSelector({
  projectId,
  projectType,
  hasVerifiedRepo,
  redirectTo,
}: {
  projectId: string;
  projectType: ProjectType;
  hasVerifiedRepo: boolean;
  redirectTo?: string;
}) {
  const t = useTranslations("scan");
  const router = useRouter();

  const availableTypes: ScanType[] =
    projectType === "CODE_REPO"
      ? ["CODE"]
      : hasVerifiedRepo
      ? ["PASSIVE", "FULL"]
      : ["PASSIVE"];

  const [scanType, setScanType] = useState<ScanType>(availableTypes[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStart() {
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/scans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scanType, projectId }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string; message?: string };
        setError(data.message ?? t("networkError"));
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
    <div className="space-y-6">
      {availableTypes.length > 1 && (
        <fieldset>
          <legend className="text-sm font-medium text-gray-300">
            {t("chooseScanType")}
          </legend>
          <div className="mt-3 space-y-3">
            {availableTypes.map((type) => (
              <label
                key={type}
                className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-700 p-3 transition-colors hover:border-gray-500 has-[:checked]:border-emerald-600 has-[:checked]:bg-emerald-950/20"
              >
                <input
                  type="radio"
                  name="scanType"
                  value={type}
                  checked={scanType === type}
                  onChange={() => setScanType(type)}
                  className="mt-0.5 accent-emerald-500"
                />
                <div>
                  <p className="text-sm font-medium text-gray-200">
                    {t(`scanType${type}Title`)}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-400">
                    {t(`scanType${type}Desc`)}
                  </p>
                </div>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}

      <button
        onClick={handleStart}
        disabled={loading}
        className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium transition-colors hover:bg-emerald-500 disabled:opacity-50"
      >
        {loading ? t("starting") : t("startScan")}
      </button>
    </div>
  );
}
