import type { IScanRepository, CreateFindingData } from "@/domain/repositories/IScanRepository";
import type { Finding, Scan, ScanStatus, ScanType } from "@/domain/entities/Scan";
import type { OWASPCategoryId } from "@/domain/value-objects/OWASPCategory";
import type { Severity } from "@/domain/value-objects/Severity";
import { prisma } from "../prisma";

type DbFinding = {
  id: string;
  scanId: string;
  category: string;
  severity: string;
  title: string;
  description: string;
  evidence: string | null;
  pointsLost: number;
};

type DbScan = {
  id: string;
  projectId: string;
  status: string;
  type: string;
  score: number | null;
  maxScore: number | null;
  inRanking: boolean;
  errorMessage: string | null;
  startedAt: Date;
  completedAt: Date | null;
  findings?: DbFinding[];
};

function toFinding(r: DbFinding): Finding {
  return {
    id: r.id,
    scanId: r.scanId,
    category: r.category as OWASPCategoryId,
    severity: r.severity as Severity,
    title: r.title,
    description: r.description,
    evidence: r.evidence,
    pointsLost: r.pointsLost,
  };
}

function toScan(r: DbScan): Scan {
  return {
    id: r.id,
    projectId: r.projectId,
    status: r.status as ScanStatus,
    type: r.type as ScanType,
    score: r.score,
    maxScore: r.maxScore,
    inRanking: r.inRanking,
    errorMessage: r.errorMessage,
    startedAt: r.startedAt,
    completedAt: r.completedAt,
    findings: (r.findings ?? []).map(toFinding),
  };
}

export class PrismaScanRepository implements IScanRepository {
  async findById(id: string): Promise<Scan | null> {
    const r = await prisma.scan.findUnique({
      where: { id },
      include: { findings: true },
    });
    return r ? toScan(r) : null;
  }

  async findByProjectId(projectId: string): Promise<Scan[]> {
    const records = await prisma.scan.findMany({
      where: { projectId },
      include: { findings: true },
      orderBy: { startedAt: "desc" },
    });
    return records.map(toScan);
  }

  async findLatestCompletedPerProject(projectIds: string[]): Promise<Map<string, Scan>> {
    if (projectIds.length === 0) return new Map();
    const records = await prisma.scan.findMany({
      where: { projectId: { in: projectIds }, status: "COMPLETED" },
      orderBy: { startedAt: "desc" },
      distinct: ["projectId"],
    });
    return new Map(records.map((r) => [r.projectId, toScan(r)]));
  }

  async findPublicPerfectScoreScans(
    limit = 20
  ): Promise<Array<{ url: string; completedAt: Date; scanType: string; projectType: string; score: number; repoUrl?: string; zipSource?: boolean }>> {
    const records = await prisma.scan.findMany({
      where: {
        status: "COMPLETED",
        score: { gte: 90 },
        project: {
          isPublic: true,
          OR: [
            { type: "WEBSITE", verified: true },
            { type: "CODE_REPO", repoVerified: true },
          ],
        },
      },
      select: {
        completedAt: true,
        score: true,
        type: true,
        project: { select: { type: true, domain: true, repoUrl: true, repoVerified: true } },
      },
      orderBy: { completedAt: "desc" },
      distinct: ["projectId"],
      take: limit,
    });
    return records
      .filter((r): r is typeof r & { completedAt: Date; score: number } => r.completedAt !== null && r.score !== null)
      .flatMap((r) => {
        const url = r.project.type === "WEBSITE" ? r.project.domain : r.project.repoUrl;
        if (!url) return [];
        const repoUrl =
          r.project.type === "WEBSITE" && r.project.repoVerified && r.project.repoUrl
            ? r.project.repoUrl
            : undefined;
        const zipSource = r.project.type === "WEBSITE" && r.type === "FULL" && !repoUrl;
        return [{ url, completedAt: r.completedAt, scanType: r.type, projectType: r.project.type, score: r.score, repoUrl, zipSource: zipSource || undefined }];
      });
  }

  async findRanking(limit = 50): Promise<Array<Scan & { projectDomain: string }>> {
    const records = (await prisma.scan.findMany({
      where: { inRanking: true, status: "COMPLETED" },
      include: { findings: true, project: { select: { domain: true } } },
      orderBy: { score: "desc" },
      take: limit,
    })) as Array<DbScan & { project: { domain: string | null } }>;
    return records.map((r) => ({ ...toScan(r), projectDomain: r.project.domain ?? "" }));
  }

  async create(projectId: string, type: ScanType = "PASSIVE"): Promise<Scan> {
    const r = await prisma.scan.create({
      data: { projectId, type },
      include: { findings: true },
    });
    return toScan(r);
  }

  async updateStatus(id: string, status: ScanStatus, errorMessage?: string): Promise<void> {
    await prisma.scan.update({
      where: { id },
      data: {
        status,
        ...(errorMessage !== undefined && { errorMessage }),
        ...(status === "FAILED" && { completedAt: new Date() }),
      },
    });
  }

  async invalidate(id: string, errorMessage: string): Promise<void> {
    await prisma.scan.update({
      where: { id },
      data: { status: "INVALID", errorMessage, completedAt: new Date() },
    });
  }

  async complete(
    id: string,
    score: number,
    maxScore: number,
    findingsData: CreateFindingData[]
  ): Promise<Scan> {
    const r = await prisma.scan.update({
      where: { id },
      data: {
        status: "COMPLETED",
        score,
        maxScore,
        completedAt: new Date(),
        findings: {
          createMany: { data: findingsData },
        },
      },
      include: { findings: true },
    });
    return toScan(r);
  }

  async updateRanking(id: string, inRanking: boolean): Promise<void> {
    await prisma.scan.update({ where: { id }, data: { inRanking } });
  }
}
