import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/infrastructure/auth/auth";
import { PrismaWebsiteRepository } from "@/infrastructure/database/repositories/PrismaWebsiteRepository";
import { PrismaScanRepository } from "@/infrastructure/database/repositories/PrismaScanRepository";
import { createScan, CreateScanError } from "@/application/use-cases/CreateScan";
import { createCompleteScan, CreateCompleteScanError } from "@/application/use-cases/CreateCompleteScan";
import { getScanQueue } from "@/infrastructure/queue/scanQueue";
import { verifyCodeMatchesSite } from "@/infrastructure/scanning/CodeVerifier";

export const dynamic = "force-dynamic";

const MAX_ZIP_BYTES = 50 * 1024 * 1024;

const basicSchema = z.object({
  scanType: z.literal("BASIC"),
  websiteId: z.string().cuid(),
});

const completeGitHubSchema = z.object({
  scanType: z.literal("COMPLETE"),
  websiteId: z.string().cuid(),
  githubUrl: z.string().url(),
});

const jsonBodySchema = z.discriminatedUnion("scanType", [basicSchema, completeGitHubSchema]);

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    return handleZipUpload(req, session.user.id);
  }

  return handleJsonRequest(req, session.user.id);
}

async function handleJsonRequest(req: NextRequest, userId: string) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = jsonBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const websiteRepo = new PrismaWebsiteRepository();
  const scanRepo = new PrismaScanRepository();

  try {
    if (parsed.data.scanType === "BASIC") {
      const scan = await createScan(
        parsed.data.websiteId,
        userId,
        websiteRepo,
        scanRepo,
        async (scanId, targetUrl) => {
          await getScanQueue().add("scan", { scanId, targetUrl, type: "BASIC" }, { attempts: 2 });
        }
      );
      return NextResponse.json(scan, { status: 201 });
    }

    // COMPLETE with GitHub URL
    const scan = await createCompleteScan(
      parsed.data.websiteId,
      userId,
      { kind: "github", githubUrl: parsed.data.githubUrl },
      websiteRepo,
      scanRepo,
      async (jobData) => {
        await getScanQueue().add("scan", jobData, {
          attempts: 1,
          removeOnComplete: { age: 300 },
        });
      }
    );
    return NextResponse.json(scan, { status: 201 });
  } catch (err) {
    if (err instanceof CreateScanError || err instanceof CreateCompleteScanError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}

async function handleZipUpload(req: NextRequest, userId: string) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart form data" }, { status: 400 });
  }

  const websiteId = formData.get("websiteId");
  const file = formData.get("zipFile");

  const websiteIdParsed = z.string().cuid().safeParse(websiteId);
  if (!websiteIdParsed.success) {
    return NextResponse.json({ error: "Invalid websiteId" }, { status: 422 });
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "zipFile is required" }, { status: 422 });
  }

  if (!file.name.endsWith(".zip")) {
    return NextResponse.json({ error: "Only .zip files are accepted" }, { status: 422 });
  }

  if (file.size > MAX_ZIP_BYTES) {
    return NextResponse.json(
      { error: "ZIP file exceeds the 50 MB limit" },
      { status: 413 }
    );
  }

  const zipBuffer = new Uint8Array(await file.arrayBuffer());
  const websiteRepo = new PrismaWebsiteRepository();

  // Verify the ZIP belongs to the target site before creating any scan record.
  const website = await websiteRepo.findById(websiteIdParsed.data);
  if (!website || website.userId !== userId || !website.verified) {
    return NextResponse.json({ error: "Website not found or not verified" }, { status: 400 });
  }
  const targetUrl = `https://${website.domain}`;
  const verification = await verifyCodeMatchesSite(zipBuffer, targetUrl, null);
  if (!verification.verified) {
    return NextResponse.json({ error: "VERIFICATION_FAILED" }, { status: 422 });
  }

  const scanRepo = new PrismaScanRepository();

  try {
    const scan = await createCompleteScan(
      websiteIdParsed.data,
      userId,
      { kind: "zip", zipBuffer },
      websiteRepo,
      scanRepo,
      async (jobData) => {
        await getScanQueue().add("scan", jobData, {
          attempts: 1,
          removeOnComplete: { age: 300 },
        });
      }
    );
    return NextResponse.json(scan, { status: 201 });
  } catch (err) {
    if (err instanceof CreateCompleteScanError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
