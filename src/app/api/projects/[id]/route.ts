import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/infrastructure/auth/auth";
import { PrismaProjectRepository } from "@/infrastructure/database/repositories/PrismaProjectRepository";

async function getOwnedProject(id: string, userId: string) {
  const repo = new PrismaProjectRepository();
  const project = await repo.findById(id);
  if (!project) return { repo, project: null, error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  if (project.userId !== userId) return { repo, project: null, error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { repo, project, error: null };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { repo, project, error } = await getOwnedProject(id, session.user.id);
  if (error) return error;

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = z.object({ isPublic: z.boolean() }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const updated = await repo.updatePrivacy(project!.id, parsed.data.isPublic);
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { repo, project, error } = await getOwnedProject(id, session.user.id);
  if (error) return error;

  await repo.delete(project!.id);
  return NextResponse.json({ ok: true });
}
