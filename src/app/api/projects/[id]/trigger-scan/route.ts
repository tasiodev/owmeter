import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PrismaProjectRepository } from "@/infrastructure/database/repositories/PrismaProjectRepository";
import { PrismaScanRepository } from "@/infrastructure/database/repositories/PrismaScanRepository";
import { createScan, CreateScanError } from "@/application/use-cases/CreateScan";
import { createCompleteScan, CreateCompleteScanError } from "@/application/use-cases/CreateCompleteScan";
import { createCodeScan, CreateCodeScanError } from "@/application/use-cases/CreateCodeScan";
import { getScanQueue } from "@/infrastructure/queue/scanQueue";
import { checkRateLimit } from "@/infrastructure/rateLimiter";

// 10 trigger-scan requests per project per hour (override via env)
const RATE_LIMIT = parseInt(process.env.TRIGGER_SCAN_RATE_LIMIT ?? "10", 10);
const RATE_WINDOW_SECS = 3600;

export const dynamic = "force-dynamic";

const bodySchema = z.object({});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // API key auth via Authorization: Bearer <key>
  const authHeader = req.headers.get("authorization") ?? "";
  const apiKey = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!apiKey) {
    return NextResponse.json({ error: "MISSING_API_KEY" }, { status: 401 });
  }

  const projectRepo = new PrismaProjectRepository();
  const project = await projectRepo.findById(id);

  if (!project || project.apiKey !== apiKey) {
    return NextResponse.json({ error: "INVALID_API_KEY" }, { status: 401 });
  }

  const rl = await checkRateLimit(`rl:trigger_scan:${id}`, RATE_LIMIT, RATE_WINDOW_SECS);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "RATE_LIMIT_EXCEEDED", retryAfter: rl.retryAfter },
      {
        status: 429,
        headers: {
          "Retry-After": String(rl.retryAfter),
          "X-RateLimit-Limit": String(RATE_LIMIT),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  // Scan type is determined by project state, never by the caller
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
        id,
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
        id,
        project.userId,
        projectRepo,
        scanRepo,
        async (jobData) => {
          await queue.add("scan", jobData, { attempts: 1 });
        }
      );
      return NextResponse.json({ scanId: scan.id, status: "queued" }, { status: 202 });
    }

    // CODE
    const scan = await createCodeScan(
      id,
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
