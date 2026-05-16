"use client";

import { useState, useEffect } from "react";

export type CardData = {
  url: string;
  href: string;
  isWebsite: boolean;
  categoriesLabel: string;
};

type Phase = "entering" | "visible" | "leaving";

const ENTER_MS = 500;
const VISIBLE_MS = 5000;
const LEAVE_MS = 500;

function ShowcaseCard({ url, href, isWebsite, categoriesLabel }: CardData) {
  const size = 80;
  const sw = 7;
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;

  return (
    <div className="shrink-0 rounded-xl border border-gray-800 bg-gray-900/60 flex items-center gap-4 px-4 py-3 w-72">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1f2937" strokeWidth={sw} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="#34d399"
            strokeWidth={sw}
            strokeLinecap="round"
            strokeDasharray={`${circ} ${circ}`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold text-emerald-400">100</span>
          <span className="text-xs text-gray-500">/100</span>
        </div>
      </div>

      <div className="flex-1 min-w-0 space-y-1.5">
        <span
          className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${
            isWebsite ? "bg-blue-900/40 text-blue-300" : "bg-violet-900/40 text-violet-300"
          }`}
        >
          {isWebsite ? "Website" : "Repo"}
        </span>
        <a href={href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 group">
          <span className="text-sm font-medium text-gray-200 group-hover:text-white truncate transition-colors">
            {url}
          </span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0 text-gray-500 group-hover:text-gray-300 transition-colors"
            aria-hidden="true"
          >
            <path d="M7 17L17 7" />
            <path d="M7 7h10v10" />
          </svg>
        </a>
        <p className="text-xs text-gray-500">{categoriesLabel}</p>
      </div>
    </div>
  );
}

export function ShowcaseCarousel({ groups }: { groups: CardData[][] }) {
  const [groupIdx, setGroupIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>("entering");

  useEffect(() => {
    if (groups.length === 0) return;
    let t: ReturnType<typeof setTimeout>;
    if (phase === "entering") {
      t = setTimeout(() => setPhase("visible"), ENTER_MS);
    } else if (phase === "visible") {
      if (groups.length <= 1) return;
      t = setTimeout(() => setPhase("leaving"), VISIBLE_MS);
    } else {
      t = setTimeout(() => {
        setGroupIdx((i) => (i + 1) % groups.length);
        setPhase("entering");
      }, LEAVE_MS);
    }
    return () => clearTimeout(t);
  }, [phase, groups.length]);

  if (groups.length === 0) return null;

  const group = groups[groupIdx] ?? [];

  const animStyle: React.CSSProperties =
    phase === "entering"
      ? { animation: `slide-in-left ${ENTER_MS}ms ease-out forwards` }
      : phase === "leaving"
      ? { animation: `slide-out-right ${LEAVE_MS}ms ease-in forwards` }
      : {};

  return (
    <div className="overflow-hidden min-h-28">
      <div className="flex gap-4 justify-center" style={animStyle}>
        {group.map((card, i) => (
          <ShowcaseCard key={`${card.url}-${i}`} {...card} />
        ))}
      </div>
    </div>
  );
}
