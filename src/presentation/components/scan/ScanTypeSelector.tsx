"use client";

import { useRef, useState } from "react";
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
    projectType === "CODE_REPO" ? ["CODE"] : ["PASSIVE", "FULL"];

  const [scanType, setScanType] = useState<ScanType>(availableTypes[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const needsZip =
    (scanType === "FULL" && !hasVerifiedRepo) ||
    (projectType === "CODE_REPO" && !hasVerifiedRepo);

  async function handleStart() {
    setError(null);

    if (needsZip) {
      if (!zipFile) {
        setError(t("zipRequired"));
        return;
      }
      if (zipFile.size > 50 * 1024 * 1024) {
        setError(t("zipTooLarge"));
        return;
      }

      setLoading(true);
      try {
        const fd = new FormData();
        fd.append("scanType", scanType);
        fd.append("projectId", projectId);
        fd.append("zipFile", zipFile);

        const res = await fetch("/api/scans/with-zip", { method: "POST", body: fd });

        if (!res.ok) {
          const data = (await res.json()) as { error?: string; message?: string };
          if (data.error === "ZIP_NOT_VERIFIED") {
            setError(t("zipNotVerified"));
          } else {
            setError(data.message ?? t("networkError"));
          }
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
      return;
    }

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
      {availableTypes.length > 1 ? (
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
                  onChange={() => {
                    setScanType(type);
                    setZipFile(null);
                    setError(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
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
      ) : (
        <div className="rounded-lg border border-gray-700 p-3">
          <p className="text-sm font-medium text-gray-200">
            {t(`scanType${availableTypes[0]}Title`)}
          </p>
          <p className="mt-0.5 text-xs text-gray-400">
            {t(`scanType${availableTypes[0]}Desc`)}
          </p>
        </div>
      )}

      {needsZip && (
        <div className="space-y-4 rounded-lg border border-gray-700 p-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              {t("zipUploadLabel")}
            </label>
            <p className="text-xs text-gray-500 mb-3">{t("zipUploadHint")}</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip,application/zip,application/x-zip-compressed"
              onChange={(e) => {
                setZipFile(e.target.files?.[0] ?? null);
                setError(null);
              }}
              className="block w-full text-sm text-gray-400 file:mr-3 file:rounded file:border-0 file:bg-gray-700 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-gray-200 hover:file:bg-gray-600"
            />
            {zipFile && (
              <p className="mt-1.5 text-xs text-emerald-400">
                {zipFile.name} ({(zipFile.size / 1024 / 1024).toFixed(1)} MB)
              </p>
            )}
          </div>

          <div className="rounded-md bg-gray-800/60 p-3">
            <p className="text-xs font-medium text-gray-300">{t("privacyTitle")}</p>
            <p className="mt-1 text-xs text-gray-500">{t("privacyDesc")}</p>
          </div>
        </div>
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
