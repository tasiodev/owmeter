import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/infrastructure/auth/auth";
import { isAdmin } from "@/infrastructure/auth/isAdmin";
import { PrismaFalsePositiveReportRepository } from "@/infrastructure/database/repositories/PrismaFalsePositiveReportRepository";
import { PrismaScanRepository } from "@/infrastructure/database/repositories/PrismaScanRepository";
import { reviewFalsePositive, ReviewFalsePositiveError } from "@/application/use-cases/ReviewFalsePositive";
import { calculateScore } from "@/domain/services/ScoringService";
import type { ScanMode } from "@/domain/services/ScoringService";
import { FOREIGN_LANG_UNEVALUATED } from "@/domain/value-objects/OWASPCategory";
import type { OWASPCategoryId } from "@/domain/value-objects/OWASPCategory";
import { fpKey, extractFilePath } from "@/domain/entities/FalsePositiveReport";
import { sendEmail, fpReviewedEmail } from "@/infrastructure/email/sendEmail";
import { prisma } from "@/infrastructure/database/prisma";

const ReviewSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  adminNote: z.string().max(1000).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id || !session.user.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { reportId } = await params;

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = ReviewSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const fpRepo = new PrismaFalsePositiveReportRepository();
  const scanRepo = new PrismaScanRepository();

  try {
    const report = await reviewFalsePositive(
      reportId,
      parsed.data.status,
      session.user.id,
      parsed.data.adminNote,
      fpRepo
    );

    // Recompute stored score for all completed scans of this project
    const [approvedFps, allScans] = await Promise.all([
      fpRepo.findApprovedByProject(report.projectId),
      scanRepo.findByProjectId(report.projectId),
    ]);

    const approvedKeys = new Set(
      approvedFps.map((r) => fpKey(r.category, r.title, r.filePath))
    );

    await Promise.all(
      allScans
        .filter((s) => s.status === "COMPLETED" && s.maxScore !== null)
        .map((scan) => {
          const isForeignLang = scan.findings.some((f) =>
            f.title.startsWith("Limited code analysis:")
          );
          const additionalUnevaluated = isForeignLang
            ? FOREIGN_LANG_UNEVALUATED
            : new Set<OWASPCategoryId>();
          const nonFpFindings = scan.findings
            .filter((f) => !approvedKeys.has(fpKey(f.category, f.title, extractFilePath(f.evidence ?? ""))))
            .map((f) => ({ ...f, evidence: f.evidence ?? undefined }));
          const { score } = calculateScore(
            nonFpFindings,
            scan.type as ScanMode,
            additionalUnevaluated
          );
          return scanRepo.updateScore(scan.id, score);
        })
    );

    // Notify reporter — fire and forget
    const reporter = await prisma.user.findUnique({
      where: { id: report.reportedById },
      select: { email: true },
    });
    if (reporter?.email) {
      void sendEmail({
        to: reporter.email,
        ...fpReviewedEmail({
          findingTitle: report.title,
          status: parsed.data.status,
          adminNote: report.adminNote,
          projectId: report.projectId,
        }),
      });
    }

    return NextResponse.json(report);
  } catch (err) {
    if (err instanceof ReviewFalsePositiveError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    throw err;
  }
}
