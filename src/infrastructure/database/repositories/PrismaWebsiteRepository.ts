import type { IWebsiteRepository } from "@/domain/repositories/IWebsiteRepository";
import type { VerificationMethod, Website } from "@/domain/entities/Website";
import { prisma } from "../prisma";

function toEntity(record: {
  id: string;
  domain: string;
  userId: string;
  verified: boolean;
  verificationToken: string;
  verificationMethod: string | null;
  verifiedAt: Date | null;
  createdAt: Date;
}): Website {
  return {
    ...record,
    verificationMethod: record.verificationMethod as VerificationMethod | null,
  };
}

export class PrismaWebsiteRepository implements IWebsiteRepository {
  async findById(id: string): Promise<Website | null> {
    const record = await prisma.website.findUnique({ where: { id } });
    return record ? toEntity(record) : null;
  }

  async findByDomainAndUserId(domain: string, userId: string): Promise<Website | null> {
    const record = await prisma.website.findUnique({ where: { domain_userId: { domain, userId } } });
    return record ? toEntity(record) : null;
  }

  async findVerifiedByDomain(domain: string): Promise<Website | null> {
    const record = await prisma.website.findFirst({ where: { domain, verified: true } });
    return record ? toEntity(record) : null;
  }

  async findByUserId(userId: string): Promise<Website[]> {
    const records = await prisma.website.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    return records.map(toEntity);
  }

  async create(data: { domain: string; userId: string }): Promise<Website> {
    const record = await prisma.website.create({ data });
    return toEntity(record);
  }

  async markVerified(id: string, method: VerificationMethod): Promise<Website> {
    const record = await prisma.website.update({
      where: { id },
      data: {
        verified: true,
        verificationMethod: method,
        verifiedAt: new Date(),
      },
    });
    return toEntity(record);
  }

  async deleteUnverifiedByDomain(domain: string, excludeUserId: string): Promise<void> {
    await prisma.website.deleteMany({
      where: { domain, verified: false, userId: { not: excludeUserId } },
    });
  }

  async delete(id: string): Promise<void> {
    await prisma.website.delete({ where: { id } });
  }
}
