import type { FalsePositiveReport, FalsePositiveStatus } from "@/domain/entities/FalsePositiveReport";
import type { IFalsePositiveReportRepository } from "@/domain/repositories/IFalsePositiveReportRepository";

export class ReviewFalsePositiveError extends Error {}

export async function reviewFalsePositive(
  reportId: string,
  status: Extract<FalsePositiveStatus, "APPROVED" | "REJECTED">,
  reviewerUserId: string,
  adminNote: string | undefined,
  fpRepo: IFalsePositiveReportRepository
): Promise<FalsePositiveReport> {
  const report = await fpRepo.findById(reportId);
  if (!report) {
    throw new ReviewFalsePositiveError("Report not found");
  }
  if (report.status === status) {
    throw new ReviewFalsePositiveError("Report already has that status");
  }
  return fpRepo.updateStatus(reportId, status, reviewerUserId, adminNote);
}
