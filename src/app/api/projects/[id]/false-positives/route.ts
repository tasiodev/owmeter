import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/infrastructure/auth/auth";
import { PrismaProjectRepository } from "@/infrastructure/database/repositories/PrismaProjectRepository";
import { PrismaFalsePositiveReportRepository } from "@/infrastructure/database/repositories/PrismaFalsePositiveReportRepository";
import { reportFalsePositive, ReportFalsePositiveError } from "@/application/use-cases/ReportFalsePositive";
import { sendEmail, fpSubmittedEmail } from "@/infrastructure/email/sendEmail";
import { prisma } from "@/infrastructure/database/prisma";

const CreateSchema = z.object({
  category: z.string().min(1),
  title: z.string().min(1).max(200),
  evidence: z.string().max(2000),
  reason: z.string().min(10).max(2000),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  try {
    const report = await reportFalsePositive(
      id,
      session.user.id,
      parsed.data.category as Parameters<typeof reportFalsePositive>[2],
      parsed.data.title,
      parsed.data.evidence,
      parsed.data.reason,
      new PrismaProjectRepository(),
      new PrismaFalsePositiveReportRepository()
    );

    // Notify admins — fire and forget
    const adminEmails = (process.env.ADMIN_EMAILS ?? "")
      .split(",").map((e) => e.trim()).filter(Boolean);
    if (adminEmails.length > 0) {
      const project = await prisma.project.findUnique({
        where: { id },
        select: { name: true },
      });
      void sendEmail({
        to: adminEmails,
        ...fpSubmittedEmail({
          projectName: project?.name ?? id,
          findingTitle: parsed.data.title,
          category: parsed.data.category,
          reason: parsed.data.reason,
        }),
      });
    }

    return NextResponse.json(report, { status: 201 });
  } catch (err) {
    if (err instanceof ReportFalsePositiveError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    throw err;
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const projectRepo = new PrismaProjectRepository();
  const project = await projectRepo.findById(id);
  if (!project || project.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const fpRepo = new PrismaFalsePositiveReportRepository();
  const reports = await fpRepo.findByProject(id);
  return NextResponse.json(reports);
}
