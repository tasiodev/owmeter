import { NextResponse } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import { OWASP_CATEGORIES, evaluationLevel } from "@/domain/value-objects/OWASPCategory";
import type { OWASPCategoryId, ScanMode } from "@/domain/value-objects/OWASPCategory";

export const dynamic = "force-dynamic";

const TOTAL_CATEGORIES = Object.keys(OWASP_CATEGORIES).length;

function evaluationStats(scanType: ScanMode) {
  const ids = Object.keys(OWASP_CATEGORIES) as OWASPCategoryId[];
  const levels = ids.map((id) => evaluationLevel(id, scanType));
  return {
    evaluated: levels.filter((l) => l !== "none").length,
    partial: levels.filter((l) => l === "partial").length,
  };
}

function scoreColor(score: number): string {
  if (score >= 80) return "#34d399";
  if (score >= 50) return "#facc15";
  return "#f87171";
}

function formatDate(date: Date, lang: "en" | "es"): string {
  return date.toLocaleDateString(lang === "es" ? "es-ES" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Approximate px width for a string at a given font-size (DejaVu Sans)
function textWidth(str: string, fontSize: number): number {
  return Math.round(str.length * fontSize * 0.6) + 16;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const lang = new URL(req.url).searchParams.get("lang") === "es" ? "es" : "en";

  const scan = await prisma.scan.findFirst({
    where: { projectId, status: "COMPLETED" },
    orderBy: { completedAt: "desc" },
    select: { score: true, type: true, completedAt: true },
  });

  const score = scan?.score ?? null;
  const label = "OWMeter";
  const value = score !== null ? `${score}/100` : (lang === "es" ? "pendiente" : "pending");
  const valueColor = score !== null ? scoreColor(score) : "#6b7280";

  // Row 2: categories evaluated + date
  let row2 = "";
  if (scan?.completedAt) {
    const { evaluated, partial } = evaluationStats(scan.type as ScanMode);
    const catsText = lang === "es"
      ? `${evaluated}/${TOTAL_CATEGORIES} categorías evaluadas`
      : `${evaluated}/${TOTAL_CATEGORIES} categories evaluated`;
    const partialText = partial > 0
      ? (lang === "es" ? ` · ${partial} parciales` : ` · ${partial} partial`)
      : "";
    const dateText = formatDate(scan.completedAt, lang);
    row2 = `${catsText}${partialText} · ${dateText}`;
  }

  // Width calculations
  const FONT1 = 11;
  const FONT2 = 9;
  const labelPx = textWidth(label, FONT1);
  const valuePx = textWidth(value, FONT1);
  const row1Px = labelPx + valuePx;
  const row2Px = row2 ? textWidth(row2, FONT2) : 0;
  const totalPx = Math.max(row1Px, row2Px);

  // Adjust value section to fill any extra width from row2
  const adjustedValuePx = totalPx - labelPx;

  const row1H = 24;
  const row2H = row2 ? 16 : 0;
  const totalH = row1H + row2H;

  const lx = Math.round(labelPx / 2);
  const vx = labelPx + Math.round(adjustedValuePx / 2);
  const r2x = Math.round(totalPx / 2);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalPx}" height="${totalH}" role="img" aria-label="${label}: ${value}">
  <title>${label}: ${value}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r"><rect width="${totalPx}" height="${totalH}" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelPx}" height="${row1H}" fill="#555"/>
    <rect x="${labelPx}" width="${adjustedValuePx}" height="${row1H}" fill="${valueColor}"/>
    <rect width="${totalPx}" height="${row1H}" fill="url(#s)"/>
    ${row2 ? `<rect y="${row1H}" width="${totalPx}" height="${row2H}" fill="#2a2a2a"/>` : ""}
  </g>
  <g fill="#fff" text-anchor="middle" font-family="DejaVu Sans,Verdana,Geneva,sans-serif">
    <g font-size="${FONT1}">
      <text x="${lx}" y="17" fill="#010101" fill-opacity=".3" aria-hidden="true">${label}</text>
      <text x="${lx}" y="16">${label}</text>
      <text x="${vx}" y="17" fill="#010101" fill-opacity=".3" aria-hidden="true">${value}</text>
      <text x="${vx}" y="16">${value}</text>
    </g>
    ${row2 ? `<g font-size="${FONT2}" fill="#bbb">
      <text x="${r2x}" y="${row1H + 11}">${row2}</text>
    </g>` : ""}
  </g>
</svg>`;

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "no-cache, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
