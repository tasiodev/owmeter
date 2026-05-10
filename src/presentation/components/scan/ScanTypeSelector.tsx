"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { PrivacyNotice } from "./PrivacyNotice";

type ScanType = "BASIC" | "COMPLETE";
type CompleteInputMethod = "zip" | "github";

const MAX_ZIP_BYTES = 50 * 1024 * 1024;

export function ScanTypeSelector({
  websiteId,
  redirectTo,
}: {
  websiteId: string;
  redirectTo?: string;
}) {
  const t = useTranslations("scan");
  const router = useRouter();

  const [scanType, setScanType] = useState<ScanType>("BASIC");
  const [inputMethod, setInputMethod] = useState<CompleteInputMethod>("zip");
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [githubUrl, setGithubUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStart() {
    setError(null);

    if (scanType === "COMPLETE") {
      if (inputMethod === "zip" && !zipFile) {
        setError(t("zipRequired"));
        return;
      }
      if (inputMethod === "zip" && zipFile && zipFile.size > MAX_ZIP_BYTES) {
        setError(t("zipTooLarge"));
        return;
      }
    }

    setLoading(true);

    try {
      let res: Response;

      if (scanType === "BASIC") {
        res = await fetch("/api/scans", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scanType: "BASIC", websiteId }),
        });
      } else if (inputMethod === "zip") {
        const fd = new FormData();
        fd.append("websiteId", websiteId);
        fd.append("zipFile", zipFile!);
        res = await fetch("/api/scans", { method: "POST", body: fd });
      } else {
        res = await fetch("/api/scans", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scanType: "COMPLETE", websiteId, githubUrl }),
        });
      }

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        const code = data.error;
        setError(code === "VERIFICATION_FAILED" ? t("verificationFailed") : t("networkError"));
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
      {/* Scan type selection */}
      <fieldset>
        <legend className="text-sm font-medium text-gray-300">
          {t("chooseScanType")}
        </legend>
        <div className="mt-3 space-y-3">
          {(["BASIC", "COMPLETE"] as ScanType[]).map((type) => (
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
                  {t(type === "BASIC" ? "basicTitle" : "completeTitle")}
                </p>
                <p className="mt-0.5 text-xs text-gray-400">
                  {t(type === "BASIC" ? "basicDesc" : "completeDesc")}
                </p>
              </div>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Complete scan options */}
      {scanType === "COMPLETE" && (
        <div className="space-y-4 rounded-lg border border-gray-700 p-4">
          <PrivacyNotice title={t("privacyTitle")} desc={t("privacyDesc")} />

          {/* Input method tabs */}
          <div className="flex gap-1 rounded-md bg-gray-800/60 p-1">
            {(["zip", "github"] as CompleteInputMethod[]).map((method) => (
              <button
                key={method}
                type="button"
                onClick={() => setInputMethod(method)}
                className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  inputMethod === method
                    ? "bg-gray-700 text-white shadow-sm"
                    : "text-gray-400 hover:text-gray-200"
                }`}
              >
                {t(method === "zip" ? "uploadZip" : "githubUrl")}
              </button>
            ))}
          </div>

          {inputMethod === "zip" ? (
            <div className="space-y-1.5">
              <input
                type="file"
                accept=".zip"
                onChange={(e) => setZipFile(e.target.files?.[0] ?? null)}
                className="block w-full cursor-pointer text-sm text-gray-400 file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-gray-700 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-gray-200 hover:file:bg-gray-600"
              />
              <p className="text-xs text-gray-500">{t("zipSizeLimit")}</p>
              {zipFile && (
                <p className="text-xs text-emerald-400">
                  {zipFile.name}{" "}
                  <span className="text-gray-500">
                    ({(zipFile.size / 1024 / 1024).toFixed(1)} MB)
                  </span>
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              <input
                type="url"
                placeholder="https://github.com/owner/repo"
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-emerald-500 focus:outline-none"
              />
              <p className="text-xs text-gray-500">{t("githubPublicOnly")}</p>
            </div>
          )}
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
