import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/infrastructure/auth/auth";
import { PrismaWebsiteRepository } from "@/infrastructure/database/repositories/PrismaWebsiteRepository";
import { PrismaScanRepository } from "@/infrastructure/database/repositories/PrismaScanRepository";
import { createScan, CreateScanError } from "@/application/use-cases/CreateScan";
import { getScanQueue } from "@/infrastructure/queue/scanQueue";

const schema = z.object({
  websiteId: z.string().cuid(),
});

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

  const websiteRepo = new PrismaWebsiteRepository();
  const scanRepo = new PrismaScanRepository();

  try {
    const scan = await createScan(
      parsed.data.websiteId,
      session.user.id,
      websiteRepo,
      scanRepo,
      async (scanId, targetUrl) => {
        await getScanQueue().add("scan", { scanId, targetUrl }, { attempts: 2 });
      }
    );
    return NextResponse.json(scan, { status: 201 });
  } catch (err) {
    if (err instanceof CreateScanError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
