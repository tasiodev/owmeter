import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/infrastructure/auth/auth";
import { PrismaWebsiteRepository } from "@/infrastructure/database/repositories/PrismaWebsiteRepository";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const repo = new PrismaWebsiteRepository();
  const website = await repo.findById(id);

  if (!website) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (website.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await repo.delete(id);

  return NextResponse.json({ ok: true });
}
