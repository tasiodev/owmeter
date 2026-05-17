import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/infrastructure/auth/auth";
import { PrismaProjectRepository } from "@/infrastructure/database/repositories/PrismaProjectRepository";
import { PrismaScanRepository } from "@/infrastructure/database/repositories/PrismaScanRepository";
import { runSourceCodeAnalysis, NoValidCodeError } from "@/infrastructure/scanning/SourceCodeAnalyzer";
import { verifyCodeMatchesSite } from "@/infrastructure/scanning/CodeVerifier";
import { deduplicateFindings, getScanQueue } from "@/infrastructure/queue/scanQueue";
import { createCodeScanFromZip, CreateCodeScanFromZipError } from "@/application/use-cases/CreateCodeScanFromZip";
import { createFullScanFromZip, CreateFullScanFromZipError } from "@/application/use-cases/CreateFullScanFromZip";
import { resolveBaseUrl } from "@/domain/entities/Project";

export const dynamic = "force-dynamic";

const MAX_ZIP_BYTES = 50 * 1024 * 1024;

const fieldSchema = z.object({
  scanType: z.enum(["CODE", "FULL"]),
  projectId: z.string().cuid(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const parsed = fieldSchema.safeParse({
    scanType: formData.get("scanType"),
    projectId: formData.get("projectId"),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const zipEntry = formData.get("zipFile");
  if (!(zipEntry instanceof File)) {
    return NextResponse.json({ error: "ZIP file is required" }, { status: 400 });
  }
  if (zipEntry.size > MAX_ZIP_BYTES) {
    return NextResponse.json(
      { error: "ZIP_TOO_LARGE", message: "ZIP file exceeds 50 MB" },
      { status: 413 }
    );
  }

  const zipBuffer = Buffer.from(await zipEntry.arrayBuffer());

  const projectRepo = new PrismaProjectRepository();
  const scanRepo = new PrismaScanRepository();
  const { scanType, projectId } = parsed.data;

  if (scanType === "FULL") {
    const project = await projectRepo.findById(projectId);
    if (project?.verified && project.domain) {
      const verification = await verifyCodeMatchesSite(zipBuffer, resolveBaseUrl(project.domain));
      if (!verification.verified) {
        return NextResponse.json(
          {
            error: "ZIP_NOT_VERIFIED",
            message: `The ZIP could not be verified as belonging to ${project.domain}. Upload the source code of the verified site.`,
            reasons: verification.reasons,
          },
          { status: 422 }
        );
      }
    }
  }

  let rawFindings;
  let sastUnevaluated;
  try {
    const result = await runSourceCodeAnalysis(zipBuffer);
    rawFindings = deduplicateFindings(result.findings);
    sastUnevaluated = result.unevaluated;
  } catch (err) {
    if (err instanceof NoValidCodeError) {
      return NextResponse.json(
        { error: "ZIP_NO_VALID_CODE", message: "The ZIP does not contain any recognizable source code files." },
        { status: 422 }
      );
    }
    return NextResponse.json({ error: "Failed to analyze ZIP file" }, { status: 422 });
  }

  try {
    if (scanType === "CODE") {
      const scan = await createCodeScanFromZip(
        projectId,
        session.user.id,
        rawFindings,
        projectRepo,
        scanRepo,
        sastUnevaluated
      );
      return NextResponse.json(scan, { status: 201 });
    }

    // FULL scan: SAST already done, enqueue website analysis
    const queue = getScanQueue();
    const scan = await createFullScanFromZip(
      projectId,
      session.user.id,
      rawFindings,
      projectRepo,
      scanRepo,
      async (jobData) => {
        await queue.add("scan", jobData, { attempts: 1, removeOnComplete: { age: 300 } });
      },
      sastUnevaluated
    );
    return NextResponse.json(scan, { status: 201 });
  } catch (err) {
    if (err instanceof CreateCodeScanFromZipError || err instanceof CreateFullScanFromZipError) {
      return NextResponse.json({ error: "SCAN_ERROR", message: err.message }, { status: 400 });
    }
    throw err;
  }
}
