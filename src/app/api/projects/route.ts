import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/infrastructure/auth/auth";
import { PrismaProjectRepository } from "@/infrastructure/database/repositories/PrismaProjectRepository";

const websiteSchema = z.object({
  type: z.literal("WEBSITE"),
  name: z.string().min(1).max(100),
  domain: z
    .string()
    .min(3)
    .max(253)
    .regex(
      /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*(?::\d{1,5})?$/,
      { message: "Invalid domain format" }
    )
    .refine(
      (domain) =>
        process.env.NODE_ENV === "development" ||
        !/^(localhost|127\.0\.0\.1)(:\d{1,5})?$/.test(domain),
      { message: "Localhost domains are not allowed" }
    ),
  isPublic: z.boolean().optional(),
});

const codeRepoSchema = z.object({
  type: z.literal("CODE_REPO"),
  name: z.string().min(1).max(100),
  isPublic: z.boolean().optional(),
});

const schema = z.discriminatedUnion("type", [websiteSchema, codeRepoSchema]);

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

  const repo = new PrismaProjectRepository();

  if (parsed.data.type === "WEBSITE") {
    const { domain } = parsed.data;

    const ownEntry = await repo.findByDomainAndUserId(domain, session.user.id);
    if (ownEntry) {
      return NextResponse.json({ error: "DOMAIN_ALREADY_IN_LIST" }, { status: 409 });
    }

    const verifiedByOther = await repo.findVerifiedByDomain(domain);
    if (verifiedByOther) {
      return NextResponse.json({ error: "DOMAIN_CLAIMED_BY_OTHER" }, { status: 409 });
    }
  }

  const project = await repo.create({
    type: parsed.data.type,
    name: parsed.data.name,
    domain: parsed.data.type === "WEBSITE" ? parsed.data.domain : undefined,
    userId: session.user.id,
    isPublic: parsed.data.isPublic,
  });

  return NextResponse.json(project, { status: 201 });
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const repo = new PrismaProjectRepository();
  const projects = await repo.findByUserId(session.user.id);

  return NextResponse.json(projects);
}
