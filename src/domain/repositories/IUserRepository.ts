export type AdminProjectSummary = {
  id: string;
  name: string;
  domain: string | null;
  type: string;
  createdAt: Date;
  lastScanScore: number | null;
  lastScanMaxScore: number | null;
  lastScanAt: Date | null;
};

export type AdminUserWithProjects = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  bannedAt: Date | null;
  createdAt: Date;
  projects: AdminProjectSummary[];
};

export interface IUserRepository {
  findAllWithProjects(search?: string): Promise<AdminUserWithProjects[]>;
  isBanned(userId: string): Promise<boolean>;
  banUser(userId: string): Promise<void>;
  unbanUser(userId: string): Promise<void>;
}
