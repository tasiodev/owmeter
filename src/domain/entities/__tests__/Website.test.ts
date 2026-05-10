import { describe, it, expect } from "vitest";
import { getVerificationInstructions } from "../Website";

describe("getVerificationInstructions", () => {
  const domain = "example.com";
  const token = "test-token-123";

  it("DNS_TXT includes the token and domain", () => {
    const result = getVerificationInstructions(domain, token, "DNS_TXT");
    expect(result).toContain(token);
    expect(result).toContain(domain);
    expect(result).toContain("_owaspchecker");
  });

  it("META_TAG includes the token as content attribute", () => {
    const result = getVerificationInstructions(domain, token, "META_TAG");
    expect(result).toContain(token);
    expect(result).toContain("owaspchecker-verify");
    expect(result).toContain('<meta');
  });

  it("FILE includes the token and the correct URL path", () => {
    const result = getVerificationInstructions(domain, token, "FILE");
    expect(result).toContain(token);
    expect(result).toContain(".well-known/owaspchecker.txt");
    expect(result).toContain(domain);
  });

  it("each method produces a distinct instruction", () => {
    const dns = getVerificationInstructions(domain, token, "DNS_TXT");
    const meta = getVerificationInstructions(domain, token, "META_TAG");
    const file = getVerificationInstructions(domain, token, "FILE");
    expect(dns).not.toEqual(meta);
    expect(meta).not.toEqual(file);
    expect(dns).not.toEqual(file);
  });
});
