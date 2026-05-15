import { NextResponse } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";

export const dynamic = "force-dynamic";

function scoreColor(score: number): string {
  if (score >= 80) return "#34d399";
  if (score >= 50) return "#facc15";
  return "#f87171";
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;

  const scan = await prisma.scan.findFirst({
    where: { projectId, status: "COMPLETED" },
    orderBy: { completedAt: "desc" },
    select: { score: true },
  });

  const score = scan?.score ?? null;
  const label = "OWASP Score";
  const value = score !== null ? `${score}/100` : "pending";
  const valueColor = score !== null ? scoreColor(score) : "#6b7280";

  // Measure text widths (approximate px at font-size 11 in DejaVu Sans)
  const charWidth = 6.5;
  const labelPx = Math.round(label.length * charWidth) + 16;
  const valuePx = Math.round(value.length * charWidth) + 16;
  const totalPx = labelPx + valuePx;

  const lx = Math.round(labelPx / 2);
  const vx = labelPx + Math.round(valuePx / 2);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${totalPx}" height="20" role="img" aria-label="${label}: ${value}">
  <title>${label}: ${value}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r"><rect width="${totalPx}" height="20" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelPx}" height="20" fill="#555"/>
    <rect x="${labelPx}" width="${valuePx}" height="20" fill="${valueColor}"/>
    <rect width="${totalPx}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="DejaVu Sans,Verdana,Geneva,sans-serif" font-size="11">
    <text x="${lx}" y="15" fill="#010101" fill-opacity=".3" aria-hidden="true">${label}</text>
    <text x="${lx}" y="14">${label}</text>
    <text x="${vx}" y="15" fill="#010101" fill-opacity=".3" aria-hidden="true">${value}</text>
    <text x="${vx}" y="14">${value}</text>
  </g>
</svg>`;

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      // Browsers always revalidate; CDNs/proxies cache for 1h
      "Cache-Control": "no-cache, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
