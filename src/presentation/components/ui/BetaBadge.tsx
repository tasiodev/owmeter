"use client";

import { useTranslations } from "next-intl";

export function BetaBadge() {
  const t = useTranslations("common");

  return (
    <div className="relative group">
      <span className="text-[10px] font-bold tracking-widest px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 select-none">
        {t("betaLabel")}
      </span>
      <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-2 z-50 w-56 rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-xs text-gray-300 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        {t("betaTooltip")}
        <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-800 border-l border-t border-gray-700 rotate-45" />
      </div>
    </div>
  );
}
