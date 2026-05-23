import React from "react";
import { type NextRequest, NextResponse } from "next/server";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { auth } from "@/infrastructure/auth/auth";
import { PrismaProjectRepository } from "@/infrastructure/database/repositories/PrismaProjectRepository";
import { PrismaScanRepository } from "@/infrastructure/database/repositories/PrismaScanRepository";
import { PrismaFalsePositiveReportRepository } from "@/infrastructure/database/repositories/PrismaFalsePositiveReportRepository";
import { CertificatePdf } from "@/infrastructure/pdf/CertificatePdf";
import { fpKey, extractFilePath } from "@/domain/entities/FalsePositiveReport";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; scanId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, scanId } = await params;
  const locale = new URL(_req.url).searchParams.get("locale") === "es" ? "es" : "en";

  const projectRepo = new PrismaProjectRepository();
  const scanRepo = new PrismaScanRepository();

  const project = await projectRepo.findById(id);
  if (!project || project.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const scan = await scanRepo.findById(scanId);
  if (!scan || scan.projectId !== id || scan.status !== "COMPLETED") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const fpRepo = new PrismaFalsePositiveReportRepository();
  const approvedFps = await fpRepo.findApprovedByProject(id);
  const approvedKeys = new Set(approvedFps.map((r) => fpKey(r.category, r.title, r.filePath)));
  const suppressedCount = scan.findings.filter((f) =>
    approvedKeys.has(fpKey(f.category, f.title, extractFilePath(f.evidence ?? "")))
  ).length;

  const element = React.createElement(
    CertificatePdf,
    { project, scan, locale, suppressedCount }
  ) as React.ReactElement<DocumentProps>;
  const buffer = await renderToBuffer(element);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="certificate-${scanId}.pdf"`,
    },
  });
}
