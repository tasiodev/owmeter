import type { FalsePositiveReport, FalsePositiveStatus } from "@/domain/entities/FalsePositiveReport";
import type { OWASPCategoryId } from "@/domain/value-objects/OWASPCategory";

export interface CreateFalsePositiveData {
  projectId: string;
  reportedById: string;
  category: OWASPCategoryId;
  title: string;
  filePath: string;
  evidence: string;
  reason: string;
}

export interface IFalsePositiveReportRepository {
  findByProject(projectId: string): Promise<FalsePositiveReport[]>;
  findApprovedByProject(projectId: string): Promise<FalsePositiveReport[]>;
  findAll(): Promise<FalsePositiveReport[]>;
  findAllWithDetails(): Promise<(FalsePositiveReport & { projectName: string; reporterEmail: string })[]>;
  findById(id: string): Promise<FalsePositiveReport | null>;
  findExisting(
    projectId: string,
    category: OWASPCategoryId,
    title: string,
    filePath: string
  ): Promise<FalsePositiveReport | null>;
  create(data: CreateFalsePositiveData): Promise<FalsePositiveReport>;
  updateStatus(
    id: string,
    status: FalsePositiveStatus,
    reviewedById: string,
    adminNote?: string
  ): Promise<FalsePositiveReport>;
}
