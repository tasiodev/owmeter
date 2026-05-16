"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

type ProjectType = "WEBSITE" | "CODE_REPO";
type Step = "type" | "details";

export function AddProjectForm() {
  const t = useTranslations("dashboard");
  const tp = useTranslations("privacy");
  const router = useRouter();

  const [step, setStep] = useState<Step>("type");
  const [projectType, setProjectType] = useState<ProjectType>("WEBSITE");
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const body =
        projectType === "WEBSITE"
          ? { type: "WEBSITE", name: name.trim(), domain: domain.trim().toLowerCase(), isPublic }
          : { type: "CODE_REPO", name: name.trim(), isPublic };

      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const { error: code } = await res.json();
        if (code === "DOMAIN_ALREADY_IN_LIST") setError(t("domainAlreadyInList"));
        else if (code === "DOMAIN_CLAIMED_BY_OTHER") setError(t("domainClaimedByOther"));
        else setError(t("networkError"));
        return;
      }

      setName("");
      setDomain("");
      setIsPublic(true);
      setStep("type");
      router.refresh();
    } catch {
      setError(t("networkError"));
    } finally {
      setLoading(false);
    }
  }

  if (step === "type") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-400">{t("selectProjectType")}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={() => { setProjectType("WEBSITE"); setStep("details"); }}
            className="cursor-pointer rounded-xl border border-gray-700 p-4 text-left space-y-1 hover:border-emerald-600 hover:bg-emerald-950/20 transition-colors"
          >
            <p className="text-sm font-medium text-gray-200">{t("typeWebsite")}</p>
            <p className="text-xs text-gray-500">{t("typeWebsiteDesc")}</p>
          </button>
          <button
            onClick={() => { setProjectType("CODE_REPO"); setStep("details"); }}
            className="cursor-pointer rounded-xl border border-gray-700 p-4 text-left space-y-1 hover:border-emerald-600 hover:bg-emerald-950/20 transition-colors"
          >
            <p className="text-sm font-medium text-gray-200">{t("typeCodeRepo")}</p>
            <p className="text-xs text-gray-500">{t("typeCodeRepoDesc")}</p>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button
        onClick={() => { setStep("type"); setError(null); }}
        className="cursor-pointer text-xs text-gray-500 hover:text-gray-300 transition-colors"
      >
        ← {t("changeType")}
      </button>
      <form onSubmit={handleSubmit} className="space-y-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("projectNamePlaceholder")}
          required
          maxLength={100}
          className="w-full px-4 py-2.5 rounded-lg bg-gray-900 border border-gray-700 focus:border-emerald-500 focus:outline-none text-sm placeholder-gray-500"
        />
        {projectType === "WEBSITE" && (
          <input
            type="text"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder={t("domainPlaceholder")}
            pattern="[a-zA-Z0-9][a-zA-Z0-9\-\.]*[a-zA-Z0-9](:\d{1,5})?"
            required
            className="w-full px-4 py-2.5 rounded-lg bg-gray-900 border border-gray-700 focus:border-emerald-500 focus:outline-none text-sm placeholder-gray-500"
          />
        )}
        <label className="flex items-start gap-3 cursor-pointer py-1 group">
          <div className="relative mt-0.5 shrink-0">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-10 h-6 rounded-full bg-gray-700 peer-checked:bg-emerald-600 transition-colors" />
            <div className="absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform peer-checked:translate-x-4" />
          </div>
          <div className="space-y-0.5">
            <p className="text-sm text-gray-300 group-hover:text-white transition-colors leading-snug">
              {tp("isPublicLabel")}
            </p>
            <p className="text-xs text-gray-500">{tp("isPublicHint")}</p>
          </div>
        </label>
        <button
          type="submit"
          disabled={loading}
          className="w-full px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-sm font-medium transition-colors"
        >
          {loading ? t("adding") : t("addProject")}
        </button>
      </form>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
