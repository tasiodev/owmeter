import type { IScanRepository } from "@/domain/repositories/IScanRepository";
import type { IWebsiteRepository } from "@/domain/repositories/IWebsiteRepository";
import type { Scan } from "@/domain/entities/Scan";

export class CreateScanError extends Error {}

export async function createScan(
  websiteId: string,
  requestingUserId: string,
  websiteRepo: IWebsiteRepository,
  scanRepo: IScanRepository,
  enqueue: (scanId: string, targetUrl: string) => Promise<void>
): Promise<Scan> {
  const website = await websiteRepo.findById(websiteId);

  if (!website) throw new CreateScanError("Website not found");
  if (website.userId !== requestingUserId) throw new CreateScanError("Unauthorized");
  if (!website.verified) throw new CreateScanError("Website ownership not verified");

  const scan = await scanRepo.create(websiteId);

  const targetUrl = `https://${website.domain}`;
  await enqueue(scan.id, targetUrl);

  return scan;
}
