import { describe, it, expect } from "vitest";
import { getDomainVerificationInstructions, getRepoVerificationInstructions } from "../Project";

describe("getDomainVerificationInstructions", () => {
  const domain = "example.com";
  const token = "test-token-123";

  it("DNS_TXT includes the token and domain", () => {
    const result = getDomainVerificationInstructions(domain, token, "DNS_TXT");
    expect(result).toContain(token);
    expect(result).toContain(domain);
    expect(result).toContain("_owmeter");
  });

  it("META_TAG includes the token as content attribute", () => {
    const result = getDomainVerificationInstructions(domain, token, "META_TAG");
    expect(result).toContain(token);
    expect(result).toContain("owmeter-verify");
    expect(result).toContain('<meta');
  });

  it("FILE includes the token and the correct URL path", () => {
    const result = getDomainVerificationInstructions(domain, token, "FILE");
    expect(result).toContain(token);
    expect(result).toContain(".well-known/owmeter.txt");
    expect(result).toContain(domain);
  });

  it("each method produces a distinct instruction", () => {
    const dns = getDomainVerificationInstructions(domain, token, "DNS_TXT");
    const meta = getDomainVerificationInstructions(domain, token, "META_TAG");
    const file = getDomainVerificationInstructions(domain, token, "FILE");
    expect(dns).not.toEqual(meta);
    expect(meta).not.toEqual(file);
    expect(dns).not.toEqual(file);
  });
});

describe("getRepoVerificationInstructions", () => {
  it("includes the token with the correct prefix", () => {
    const result = getRepoVerificationInstructions("my-token-abc");
    expect(result).toContain("owmeter-verify=my-token-abc");
    expect(result).toContain(".owmeter");
  });
});
