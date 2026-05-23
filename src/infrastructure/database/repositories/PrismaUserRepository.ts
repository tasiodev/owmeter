import type { IUserRepository, AdminUserWithProjects, AdminProjectSummary } from "@/domain/repositories/IUserRepository";
import { prisma } from "../prisma";

export class PrismaUserRepository implements IUserRepository {
  async findAllWithProjects(search?: string): Promise<AdminUserWithProjects[]> {
    const where = search
      ? {
          OR: [
            { email: { contains: search, mode: "insensitive" as const } },
            { name: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : undefined;

    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        bannedAt: true,
        createdAt: true,
        projects: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            name: true,
            domain: true,
            type: true,
            createdAt: true,
            scans: {
              where: { status: "COMPLETED" },
              orderBy: { completedAt: "desc" },
              take: 1,
              select: { score: true, maxScore: true, completedAt: true },
            },
          },
        },
      },
    });

    return users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      image: u.image,
      bannedAt: u.bannedAt,
      createdAt: u.createdAt,
      projects: u.projects.map((p): AdminProjectSummary => {
        const last = p.scans[0] ?? null;
        return {
          id: p.id,
          name: p.name,
          domain: p.domain,
          type: p.type,
          createdAt: p.createdAt,
          lastScanScore: last?.score ?? null,
          lastScanMaxScore: last?.maxScore ?? null,
          lastScanAt: last?.completedAt ?? null,
        };
      }),
    }));
  }

  async isBanned(userId: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { bannedAt: true },
    });
    return user?.bannedAt != null;
  }

  async banUser(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { bannedAt: new Date() },
    });
  }

  async unbanUser(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { bannedAt: null },
    });
  }
}
