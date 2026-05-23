import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/infrastructure/auth/auth";
import { isAdmin } from "@/infrastructure/auth/isAdmin";
import { PrismaProjectRepository } from "@/infrastructure/database/repositories/PrismaProjectRepository";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await auth();
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { projectId } = await params;
  const repo = new PrismaProjectRepository();
  const project = await repo.findById(projectId);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await repo.delete(projectId);
  return NextResponse.json({ ok: true });
}
