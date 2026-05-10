import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/infrastructure/auth/auth";
import { PrismaScanRepository } from "@/infrastructure/database/repositories/PrismaScanRepository";
import { PrismaWebsiteRepository } from "@/infrastructure/database/repositories/PrismaWebsiteRepository";

const rankingSchema = z.object({ inRanking: z.boolean() });

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const scanRepo = new PrismaScanRepository();
  const scan = await scanRepo.findById(id);

  if (!scan) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Verify ownership
  const websiteRepo = new PrismaWebsiteRepository();
  const website = await websiteRepo.findById(scan.websiteId);
  if (website?.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(scan);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const parsed = rankingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { id } = await params;
  const scanRepo = new PrismaScanRepository();
  const scan = await scanRepo.findById(id);

  if (!scan) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const websiteRepo = new PrismaWebsiteRepository();
  const website = await websiteRepo.findById(scan.websiteId);
  if (website?.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await scanRepo.updateRanking(id, parsed.data.inRanking);

  return NextResponse.json({ ok: true });
}
