import type { IWebsiteRepository } from "@/domain/repositories/IWebsiteRepository";
import type { Website, VerificationMethod } from "@/domain/entities/Website";

export class VerificationError extends Error {}

async function checkDnsTxt(domain: string, token: string): Promise<boolean> {
  try {
    const { promises: dns } = await import("dns");
    const records = await dns.resolveTxt(`_owaspchecker.${domain}`);
    return records.some((r) => r.join("") === token);
  } catch {
    return false;
  }
}

async function checkMetaTag(domain: string, token: string): Promise<boolean> {
  try {
    const res = await fetch(`https://${domain}`, { signal: AbortSignal.timeout(10000) });
    const html = await res.text();
    return html.includes(`owaspchecker-verify" content="${token}"`);
  } catch {
    return false;
  }
}

async function checkFile(domain: string, token: string): Promise<boolean> {
  try {
    const res = await fetch(`https://${domain}/.well-known/owaspchecker.txt`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return false;
    const text = await res.text();
    return text.trim() === token;
  } catch {
    return false;
  }
}

export async function verifyOwnership(
  websiteId: string,
  requestingUserId: string,
  method: VerificationMethod,
  repo: IWebsiteRepository
): Promise<Website> {
  const website = await repo.findById(websiteId);

  if (!website) throw new VerificationError("Website not found");
  if (website.userId !== requestingUserId) throw new VerificationError("Unauthorized");
  if (website.verified) return website;

  const token = website.verificationToken;
  const domain = website.domain;

  let verified = false;

  switch (method) {
    case "DNS_TXT":
      verified = await checkDnsTxt(domain, token);
      break;
    case "META_TAG":
      verified = await checkMetaTag(domain, token);
      break;
    case "FILE":
      verified = await checkFile(domain, token);
      break;
  }

  if (!verified) {
    throw new VerificationError(`Verification failed. Ensure the ${method} is correctly set.`);
  }

  const result = await repo.markVerified(websiteId, method);
  await repo.deleteUnverifiedByDomain(website.domain, requestingUserId);
  return result;
}
