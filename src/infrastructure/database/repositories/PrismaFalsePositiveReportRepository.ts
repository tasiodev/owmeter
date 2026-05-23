import type {
  IFalsePositiveReportRepository,
  CreateFalsePositiveData,
} from "@/domain/repositories/IFalsePositiveReportRepository";
import type { FalsePositiveReport, FalsePositiveStatus } from "@/domain/entities/FalsePositiveReport";
import type { OWASPCategoryId } from "@/domain/value-objects/OWASPCategory";
import { prisma } from "../prisma";

type DbReport = {
  id: string;
  projectId: string;
  reportedById: string;
  category: string;
  title: string;
  filePath: string;
  evidence: string;
  reason: string;
  status: string;
  reviewedById: string | null;
  reviewedAt: Date | null;
  adminNote: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function toReport(r: DbReport): FalsePositiveReport {
  return {
    id: r.id,
    projectId: r.projectId,
    reportedById: r.reportedById,
    category: r.category as OWASPCategoryId,
    title: r.title,
    filePath: r.filePath,
    evidence: r.evidence,
    reason: r.reason,
    status: r.status as FalsePositiveStatus,
    reviewedById: r.reviewedById,
    reviewedAt: r.reviewedAt,
    adminNote: r.adminNote,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export class PrismaFalsePositiveReportRepository implements IFalsePositiveReportRepository {
  async findByProject(projectId: string): Promise<FalsePositiveReport[]> {
    const rows = await prisma.falsePositiveReport.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toReport);
  }

  async findApprovedByProject(projectId: string): Promise<FalsePositiveReport[]> {
    const rows = await prisma.falsePositiveReport.findMany({
      where: { projectId, status: "APPROVED" },
    });
    return rows.map(toReport);
  }

  async findAll(): Promise<FalsePositiveReport[]> {
    const rows = await prisma.falsePositiveReport.findMany({ orderBy: { createdAt: "desc" } });
    return rows.map(toReport);
  }

  async findAllWithDetails(): Promise<(FalsePositiveReport & { projectName: string; reporterEmail: string })[]> {
    const rows = await prisma.falsePositiveReport.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        reportedBy: { select: { email: true } },
        project: { select: { name: true } },
      },
    });
    return rows.map((r) => ({
      ...toReport(r),
      projectName: r.project.name,
      reporterEmail: r.reportedBy.email ?? "",
    }));
  }

  async findById(id: string): Promise<FalsePositiveReport | null> {
    const row = await prisma.falsePositiveReport.findUnique({ where: { id } });
    return row ? toReport(row) : null;
  }

  async findExisting(
    projectId: string,
    category: OWASPCategoryId,
    title: string,
    filePath: string
  ): Promise<FalsePositiveReport | null> {
    const row = await prisma.falsePositiveReport.findUnique({
      where: { projectId_category_title_filePath: { projectId, category, title, filePath } },
    });
    return row ? toReport(row) : null;
  }

  async create(data: CreateFalsePositiveData): Promise<FalsePositiveReport> {
    const row = await prisma.falsePositiveReport.create({ data });
    return toReport(row);
  }

  async updateStatus(
    id: string,
    status: FalsePositiveStatus,
    reviewedById: string,
    adminNote?: string
  ): Promise<FalsePositiveReport> {
    const row = await prisma.falsePositiveReport.update({
      where: { id },
      data: { status, reviewedById, reviewedAt: new Date(), adminNote: adminNote ?? null },
    });
    return toReport(row);
  }
}
