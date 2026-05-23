import type { Finding, Scan, ScanStatus, ScanType } from "../entities/Scan";

export interface CreateFindingData {
  category: Finding["category"];
  severity: Finding["severity"];
  title: string;
  description: string;
  evidence?: string;
  pointsLost: number;
}

export interface IScanRepository {
  findById(id: string): Promise<Scan | null>;
  findByProjectId(projectId: string): Promise<Scan[]>;
  findLatestCompletedPerProject(projectIds: string[]): Promise<Map<string, Scan>>;
  findRanking(limit?: number): Promise<Array<Scan & { projectDomain: string }>>;
  create(projectId: string, type?: ScanType): Promise<Scan>;
  updateStatus(id: string, status: ScanStatus, errorMessage?: string): Promise<void>;
  invalidate(id: string, errorMessage: string): Promise<void>;
  complete(id: string, score: number, maxScore: number, findings: CreateFindingData[]): Promise<Scan>;
  updateRanking(id: string, inRanking: boolean): Promise<void>;
  updateScore(id: string, score: number): Promise<void>;
}
