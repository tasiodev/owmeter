import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/infrastructure/auth/auth";
import { PrismaWebsiteRepository } from "@/infrastructure/database/repositories/PrismaWebsiteRepository";

const schema = z.object({
  domain: z
    .string()
    .min(3)
    .max(253)
    .regex(/^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/, {
      message: "Invalid domain format",
    }),
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

  const { domain } = parsed.data;
  const repo = new PrismaWebsiteRepository();

  const existing = await repo.findByDomain(domain);
  if (existing) {
    return NextResponse.json({ error: "Domain already registered" }, { status: 409 });
  }

  const website = await repo.create({ domain, userId: session.user.id });

  return NextResponse.json(website, { status: 201 });
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const repo = new PrismaWebsiteRepository();
  const websites = await repo.findByUserId(session.user.id);

  return NextResponse.json(websites);
}
