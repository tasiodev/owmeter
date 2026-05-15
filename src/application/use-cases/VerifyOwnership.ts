import type { IProjectRepository } from "@/domain/repositories/IProjectRepository";
import type { Project, VerificationMethod } from "@/domain/entities/Project";

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

export async function verifyDomainOwnership(
  projectId: string,
  requestingUserId: string,
  method: VerificationMethod,
  repo: IProjectRepository
): Promise<Project> {
  const project = await repo.findById(projectId);

  if (!project) throw new VerificationError("Project not found");
  if (project.userId !== requestingUserId) throw new VerificationError("Unauthorized");
  if (project.type !== "WEBSITE") throw new VerificationError("Domain verification only applies to WEBSITE projects");
  if (!project.domain) throw new VerificationError("Project has no domain configured");
  if (project.verified) return project;

  const token = project.verificationToken;
  const domain = project.domain;

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

  const result = await repo.markDomainVerified(projectId, method);
  await repo.deleteUnverifiedByDomain(domain, requestingUserId);
  return result;
}
