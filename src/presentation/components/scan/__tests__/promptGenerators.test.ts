import { describe, it, expect } from "vitest";
import { generateFindingPrompt, generateAllFindingsPrompt } from "../promptGenerators";
import type { Finding } from "@/domain/entities/Scan";

const baseFinding: Finding = {
  id: "f1",
  scanId: "s1",
  category: "A05_SECURITY_MISCONFIGURATION",
  severity: "MEDIUM",
  title: "Missing Content-Security-Policy header",
  description: "No CSP header found. This increases the risk of XSS attacks.",
  evidence: null,
  pointsLost: 2,
};

describe("generateFindingPrompt", () => {
  it("includes the issue title", () => {
    const prompt = generateFindingPrompt(baseFinding);
    expect(prompt).toContain("Missing Content-Security-Policy header");
  });

  it("includes the severity", () => {
    const prompt = generateFindingPrompt(baseFinding);
    expect(prompt).toContain("MEDIUM");
  });

  it("includes the OWASP category name", () => {
    const prompt = generateFindingPrompt(baseFinding);
    expect(prompt).toContain("A05:2021 Security Misconfiguration");
  });

  it("includes the description", () => {
    const prompt = generateFindingPrompt(baseFinding);
    expect(prompt).toContain("No CSP header found.");
  });

  it("does not include evidence section when evidence is null", () => {
    const prompt = generateFindingPrompt(baseFinding);
    expect(prompt).not.toContain("Evidence");
  });

  it("includes evidence when present", () => {
    const finding: Finding = { ...baseFinding, evidence: "https://example.com/admin" };
    const prompt = generateFindingPrompt(finding);
    expect(prompt).toContain("Evidence");
    expect(prompt).toContain("https://example.com/admin");
  });

  it("includes a request for implementation steps", () => {
    const prompt = generateFindingPrompt(baseFinding);
    expect(prompt).toContain("Step-by-step implementation guide");
  });
});

describe("generateAllFindingsPrompt", () => {
  const findings: Finding[] = [
    baseFinding,
    {
      id: "f2",
      scanId: "s1",
      category: "A02_CRYPTOGRAPHIC_FAILURES",
      severity: "HIGH",
      title: "Missing Strict-Transport-Security (HSTS) header",
      description: "The server does not set HSTS.",
      evidence: null,
      pointsLost: 4,
    },
  ];

  it("includes all finding titles", () => {
    const prompt = generateAllFindingsPrompt(findings);
    expect(prompt).toContain("Missing Content-Security-Policy header");
    expect(prompt).toContain("Missing Strict-Transport-Security (HSTS) header");
  });

  it("mentions the total number of findings", () => {
    const prompt = generateAllFindingsPrompt(findings);
    expect(prompt).toContain("2 security issues");
  });

  it("includes the domain when provided", () => {
    const prompt = generateAllFindingsPrompt(findings, "example.com");
    expect(prompt).toContain("on example.com");
  });

  it("uses generic wording when domain is not provided", () => {
    const prompt = generateAllFindingsPrompt(findings);
    expect(prompt).toContain("on my website");
  });

  it("sorts findings by severity (CRITICAL first)", () => {
    const mixed: Finding[] = [
      { ...baseFinding, id: "low", severity: "LOW", title: "Low severity issue" },
      { ...baseFinding, id: "crit", severity: "CRITICAL", title: "Critical issue" },
      { ...baseFinding, id: "med", severity: "MEDIUM", title: "Medium issue" },
    ];
    const prompt = generateAllFindingsPrompt(mixed);
    const critIdx = prompt.indexOf("Critical issue");
    const medIdx = prompt.indexOf("Medium issue");
    const lowIdx = prompt.indexOf("Low severity issue");
    expect(critIdx).toBeLessThan(medIdx);
    expect(medIdx).toBeLessThan(lowIdx);
  });

  it("uses singular 'issue' when there is exactly one finding", () => {
    const prompt = generateAllFindingsPrompt([baseFinding]);
    expect(prompt).toContain("1 security issue");
    expect(prompt).not.toContain("1 security issues");
  });

  it("includes a request for fix and verification", () => {
    const prompt = generateAllFindingsPrompt(findings);
    expect(prompt).toContain("Step-by-step implementation guide");
    expect(prompt).toContain("How to verify it is working");
  });
});
