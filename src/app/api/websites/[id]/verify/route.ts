import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/infrastructure/auth/auth";
import { PrismaWebsiteRepository } from "@/infrastructure/database/repositories/PrismaWebsiteRepository";
import { verifyOwnership, VerificationError } from "@/application/use-cases/VerifyOwnership";

const schema = z.object({
  method: z.enum(["DNS_TXT", "META_TAG", "FILE"]),
});

export async function POST(
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

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { id } = await params;
  const repo = new PrismaWebsiteRepository();

  try {
    const website = await verifyOwnership(id, session.user.id, parsed.data.method, repo);
    return NextResponse.json(website);
  } catch (err) {
    if (err instanceof VerificationError) {
      return NextResponse.json({ error: "VERIFY_FAILED" }, { status: 400 });
    }
    throw err;
  }
}
