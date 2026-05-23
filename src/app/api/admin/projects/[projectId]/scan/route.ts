import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/infrastructure/auth/auth";
import { isAdmin } from "@/infrastructure/auth/isAdmin";
import { PrismaProjectRepository } from "@/infrastructure/database/repositories/PrismaProjectRepository";
import { PrismaScanRepository } from "@/infrastructure/database/repositories/PrismaScanRepository";
import { createScan, CreateScanError } from "@/application/use-cases/CreateScan";
import { createCompleteScan, CreateCompleteScanError } from "@/application/use-cases/CreateCompleteScan";
import { createCodeScan, CreateCodeScanError } from "@/application/use-cases/CreateCodeScan";
import { getScanQueue } from "@/infrastructure/queue/scanQueue";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await auth();
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { projectId } = await params;
  const projectRepo = new PrismaProjectRepository();
  const project = await projectRepo.findById(projectId);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const scanType =
    project.type === "CODE_REPO"
      ? "CODE"
      : project.repoVerified
      ? "FULL"
      : "PASSIVE";

  const scanRepo = new PrismaScanRepository();
  const queue = getScanQueue();

  try {
    if (scanType === "PASSIVE") {
      const scan = await createScan(
        projectId,
        project.userId,
        projectRepo,
        scanRepo,
        async (scanId, targetUrl) => {
          await queue.add("scan", { scanId, targetUrl, type: "PASSIVE" }, { attempts: 2 });
        }
      );
      return NextResponse.json({ scanId: scan.id, status: "queued" }, { status: 202 });
    }

    if (scanType === "FULL") {
      const scan = await createCompleteScan(
        projectId,
        project.userId,
        projectRepo,
        scanRepo,
        async (jobData) => {
          await queue.add("scan", jobData, { attempts: 1 });
        }
      );
      return NextResponse.json({ scanId: scan.id, status: "queued" }, { status: 202 });
    }

    const scan = await createCodeScan(
      projectId,
      project.userId,
      projectRepo,
      scanRepo,
      async (jobData) => {
        await queue.add("scan", jobData, { attempts: 1 });
      }
    );
    return NextResponse.json({ scanId: scan.id, status: "queued" }, { status: 202 });
  } catch (err) {
    if (
      err instanceof CreateScanError ||
      err instanceof CreateCompleteScanError ||
      err instanceof CreateCodeScanError
    ) {
      return NextResponse.json({ error: "SCAN_ERROR", message: err.message }, { status: 400 });
    }
    throw err;
  }
}
