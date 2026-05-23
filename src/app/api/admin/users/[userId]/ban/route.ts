import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/infrastructure/auth/auth";
import { isAdmin } from "@/infrastructure/auth/isAdmin";
import { PrismaUserRepository } from "@/infrastructure/database/repositories/PrismaUserRepository";
import { prisma } from "@/infrastructure/database/prisma";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await auth();
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId } = await params;

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (isAdmin(target.email)) {
    return NextResponse.json({ error: "Cannot ban an admin" }, { status: 400 });
  }

  await new PrismaUserRepository().banUser(userId);
  return NextResponse.json({ ok: true });
}
