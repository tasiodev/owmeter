import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/infrastructure/auth/auth";
import { isAdmin } from "@/infrastructure/auth/isAdmin";
import { PrismaUserRepository } from "@/infrastructure/database/repositories/PrismaUserRepository";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const search = req.nextUrl.searchParams.get("search") ?? undefined;
  const users = await new PrismaUserRepository().findAllWithProjects(search?.trim() || undefined);
  return NextResponse.json(users);
}
