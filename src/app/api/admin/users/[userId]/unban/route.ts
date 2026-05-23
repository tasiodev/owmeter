import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/infrastructure/auth/auth";
import { isAdmin } from "@/infrastructure/auth/isAdmin";
import { PrismaUserRepository } from "@/infrastructure/database/repositories/PrismaUserRepository";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await auth();
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId } = await params;
  await new PrismaUserRepository().unbanUser(userId);
  return NextResponse.json({ ok: true });
}
