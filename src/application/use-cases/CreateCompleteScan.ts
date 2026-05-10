import type { IScanRepository } from "@/domain/repositories/IScanRepository";
import type { IWebsiteRepository } from "@/domain/repositories/IWebsiteRepository";
import type { Scan } from "@/domain/entities/Scan";
import { parseGitHubUrl, GitHubFetchError } from "@/infrastructure/scanning/GitHubFetcher";

export type CompleteScanInput =
  | { kind: "zip"; zipBuffer: Uint8Array }
  | { kind: "github"; githubUrl: string };

export type CompleteScanJobData =
  | { scanId: string; targetUrl: string; type: "COMPLETE"; sourceZip: string }
  | { scanId: string; targetUrl: string; type: "COMPLETE"; githubUrl: string };

export class CreateCompleteScanError extends Error {}

const MAX_ZIP_BYTES = 50 * 1024 * 1024;

export async function createCompleteScan(
  websiteId: string,
  requestingUserId: string,
  input: CompleteScanInput,
  websiteRepo: IWebsiteRepository,
  scanRepo: IScanRepository,
  enqueue: (jobData: CompleteScanJobData) => Promise<void>
): Promise<Scan> {
  const website = await websiteRepo.findById(websiteId);

  if (!website) throw new CreateCompleteScanError("Website not found");
  if (website.userId !== requestingUserId) throw new CreateCompleteScanError("Unauthorized");
  if (!website.verified) throw new CreateCompleteScanError("Website ownership not verified");

  if (input.kind === "zip") {
    if (input.zipBuffer.byteLength > MAX_ZIP_BYTES) {
      throw new CreateCompleteScanError("ZIP file exceeds 50 MB limit");
    }
  } else {
    try {
      parseGitHubUrl(input.githubUrl);
    } catch (err) {
      throw new CreateCompleteScanError(
        err instanceof GitHubFetchError ? err.message : "Invalid GitHub URL"
      );
    }
  }

  const targetUrl = `https://${website.domain}`;
  const scan = await scanRepo.create(websiteId, "COMPLETE");

  let jobData: CompleteScanJobData;
  if (input.kind === "zip") {
    jobData = {
      scanId: scan.id,
      targetUrl,
      type: "COMPLETE",
      sourceZip: Buffer.from(input.zipBuffer).toString("base64"),
    };
  } else {
    jobData = {
      scanId: scan.id,
      targetUrl,
      type: "COMPLETE",
      githubUrl: input.githubUrl,
    };
  }

  await enqueue(jobData);
  return scan;
}
