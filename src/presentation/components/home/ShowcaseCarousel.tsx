"use client";

import { useState, useEffect } from "react";

export type CardData = {
  url: string;
  href: string;
  isWebsite: boolean;
  categoriesLabel: string;
  score: number;
  repoUrl?: string;
  zipSourceLabel?: string;
};

type Phase = "entering" | "visible" | "leaving";

const ENTER_MS = 500;
const VISIBLE_MS = 5000;
const LEAVE_MS = 500;

function ExternalLinkIcon() {
  return (
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
  );
}

function repoDisplayUrl(repoUrl: string): string {
  try {
    const { hostname, pathname } = new URL(repoUrl);
    return `${hostname}${pathname}`.replace(/\/$/, "");
  } catch {
    return repoUrl;
  }
}

function ShowcaseCard({ url, href, isWebsite, categoriesLabel, score, repoUrl, zipSourceLabel }: CardData) {
  const size = 80;
  const sw = 7;
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * (score / 100);

  return (
    <div className="shrink-0 rounded-xl border border-gray-800 bg-gray-900/60 flex items-center gap-4 px-4 py-3 w-80">
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
            strokeDasharray={`${dash} ${circ}`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold text-emerald-400">{score}</span>
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
          <ExternalLinkIcon />
        </a>
        {repoUrl && (
          <a
            href={repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 group"
            title={repoUrl}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="shrink-0 text-gray-500 group-hover:text-gray-300 transition-colors"
              aria-hidden="true"
            >
              <path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.167 6.839 9.49.5.092.682-.217.682-.482 0-.237-.009-.868-.014-1.703-2.782.604-3.369-1.34-3.369-1.34-.454-1.154-1.11-1.462-1.11-1.462-.908-.62.069-.607.069-.607 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.087.636-1.337-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836a9.59 9.59 0 0 1 2.504.337c1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.741 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
            </svg>
            <span className="text-xs text-gray-500 group-hover:text-gray-300 truncate transition-colors">
              {repoDisplayUrl(repoUrl)}
            </span>
          </a>
        )}
        {!repoUrl && zipSourceLabel && (
          <div className="flex items-center gap-1">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0 text-gray-600"
              aria-hidden="true"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span className="text-xs text-gray-600">{zipSourceLabel}</span>
          </div>
        )}
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
    <div className="overflow-hidden min-h-32">
      <div className="flex gap-4 justify-center" style={animStyle}>
        {group.map((card, i) => (
          <ShowcaseCard key={`${card.url}-${i}`} {...card} />
        ))}
      </div>
    </div>
  );
}
