export type VerificationMethod = "DNS_TXT" | "META_TAG" | "FILE";

export interface Website {
  id: string;
  domain: string;
  userId: string;
  verified: boolean;
  verificationToken: string;
  verificationMethod: VerificationMethod | null;
  verifiedAt: Date | null;
  createdAt: Date;
}

export function getVerificationInstructions(
  domain: string,
  token: string,
  method: VerificationMethod
): string {
  switch (method) {
    case "DNS_TXT":
      return `Add a DNS TXT record to ${domain}:\nName: _owaspchecker\nValue: ${token}`;
    case "META_TAG":
      return `Add this tag to the <head> of your homepage:\n<meta name="owaspchecker-verify" content="${token}">`;
    case "FILE":
      return `Create a file at:\nhttps://${domain}/.well-known/owaspchecker.txt\nWith content: ${token}`;
  }
}
