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
  websiteId: string;
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
    websiteId: r.websiteId,
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

  async findByWebsiteId(websiteId: string): Promise<Scan[]> {
    const records = await prisma.scan.findMany({
      where: { websiteId },
      include: { findings: true },
      orderBy: { startedAt: "desc" },
    });
    return records.map(toScan);
  }

  async findLatestCompletedPerWebsite(websiteIds: string[]): Promise<Map<string, Scan>> {
    if (websiteIds.length === 0) return new Map();
    const records = await prisma.scan.findMany({
      where: { websiteId: { in: websiteIds }, status: "COMPLETED" },
      orderBy: { startedAt: "desc" },
      distinct: ["websiteId"],
    });
    return new Map(records.map((r) => [r.websiteId, toScan(r)]));
  }

  async findRanking(limit = 50): Promise<Array<Scan & { websiteDomain: string }>> {
    const records = (await prisma.scan.findMany({
      where: { inRanking: true, status: "COMPLETED" },
      include: { findings: true, website: { select: { domain: true } } },
      orderBy: { score: "desc" },
      take: limit,
    })) as Array<DbScan & { website: { domain: string } }>;
    return records.map((r) => ({ ...toScan(r), websiteDomain: r.website.domain }));
  }

  async create(websiteId: string, type: ScanType = "BASIC"): Promise<Scan> {
    const r = await prisma.scan.create({
      data: { websiteId, type },
      include: { findings: true },
    });
    return toScan(r);
  }

  async updateStatus(id: string, status: ScanStatus): Promise<void> {
    await prisma.scan.update({ where: { id }, data: { status } });
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
