import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/infrastructure/auth/auth";
import { PrismaProjectRepository } from "@/infrastructure/database/repositories/PrismaProjectRepository";
import { PrismaScanRepository } from "@/infrastructure/database/repositories/PrismaScanRepository";
import { createScan, CreateScanError } from "@/application/use-cases/CreateScan";
import { createCompleteScan, CreateCompleteScanError } from "@/application/use-cases/CreateCompleteScan";
import { createCodeScan, CreateCodeScanError } from "@/application/use-cases/CreateCodeScan";
import { getScanQueue } from "@/infrastructure/queue/scanQueue";

export const dynamic = "force-dynamic";

const passiveSchema = z.object({
  scanType: z.literal("PASSIVE"),
  projectId: z.string().cuid(),
});

const fullSchema = z.object({
  scanType: z.literal("FULL"),
  projectId: z.string().cuid(),
});

const codeSchema = z.object({
  scanType: z.literal("CODE"),
  projectId: z.string().cuid(),
});

const schema = z.discriminatedUnion("scanType", [passiveSchema, fullSchema, codeSchema]);

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const projectRepo = new PrismaProjectRepository();
  const scanRepo = new PrismaScanRepository();
  const queue = getScanQueue();

  try {
    if (parsed.data.scanType === "PASSIVE") {
      const scan = await createScan(
        parsed.data.projectId,
        session.user.id,
        projectRepo,
        scanRepo,
        async (scanId, targetUrl) => {
          await queue.add("scan", { scanId, targetUrl, type: "PASSIVE" }, { attempts: 2 });
        }
      );
      return NextResponse.json(scan, { status: 201 });
    }

    if (parsed.data.scanType === "FULL") {
      const scan = await createCompleteScan(
        parsed.data.projectId,
        session.user.id,
        projectRepo,
        scanRepo,
        async (jobData) => {
          await queue.add("scan", jobData, { attempts: 1, removeOnComplete: { age: 300 } });
        }
      );
      return NextResponse.json(scan, { status: 201 });
    }

    // CODE scan
    const scan = await createCodeScan(
      parsed.data.projectId,
      session.user.id,
      projectRepo,
      scanRepo,
      async (jobData) => {
        await queue.add("scan", jobData, { attempts: 1, removeOnComplete: { age: 300 } });
      }
    );
    return NextResponse.json(scan, { status: 201 });
  } catch (err) {
    if (
      err instanceof CreateScanError ||
      err instanceof CreateCompleteScanError ||
      err instanceof CreateCodeScanError
    ) {
      const isNotVerified =
        err.message.includes("not verified") || err.message.includes("not verified");
      return NextResponse.json(
        { error: isNotVerified ? "NOT_VERIFIED" : "SCAN_ERROR", message: err.message },
        { status: 400 }
      );
    }
    throw err;
  }
}
