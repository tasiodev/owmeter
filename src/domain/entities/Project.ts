export type ProjectType = "WEBSITE" | "CODE_REPO";
export type VerificationMethod = "DNS_TXT" | "META_TAG" | "FILE";

export interface Project {
  id: string;
  type: ProjectType;
  name: string;
  userId: string;
  // Domain verification (WEBSITE)
  domain: string | null;
  verified: boolean;
  verificationToken: string;
  verificationMethod: VerificationMethod | null;
  verifiedAt: Date | null;
  // Repo verification (WEBSITE optional, CODE_REPO required)
  repoUrl: string | null;
  repoVerified: boolean;
  repoVerificationToken: string | null;
  repoVerifiedAt: Date | null;
  // GitHub App private repo (optional)
  githubInstallationNumericId: number | null;
  githubRepoFullName: string | null;
  // Visibility
  isPublic: boolean;
  // CI/CD integration
  apiKey: string;
  createdAt: Date;
}

// Returns http:// for localhost/127.0.0.1 (with optional port), https:// for everything else.
export function resolveBaseUrl(domain: string): string {
  const isLocal = /^(localhost|127\.0\.0\.1)(:\d{1,5})?$/.test(domain);
  return `${isLocal ? "http" : "https"}://${domain}`;
}

export function getDomainVerificationInstructions(
  domain: string,
  token: string,
  method: VerificationMethod
): string {
  switch (method) {
    case "DNS_TXT":
      return `Add a DNS TXT record to ${domain}:\nName: _owmeter\nValue: ${token}`;
    case "META_TAG":
      return `Add this tag to the <head> of your homepage:\n<meta name="owmeter-verify" content="${token}" />`;
    case "FILE":
      return `Create a file at:\n${resolveBaseUrl(domain)}/.well-known/owmeter.txt\nWith content: ${token}`;
  }
}

export function getRepoVerificationInstructions(token: string): string {
  return `Create a file named \`.owmeter\` at the root of your repository with this exact content:\nowmeter-verify=${token}`;
}
