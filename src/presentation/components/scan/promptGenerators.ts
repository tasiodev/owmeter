import { OWASP_CATEGORIES } from "@/domain/value-objects/OWASPCategory";
import type { Finding } from "@/domain/entities/Scan";

export function generateFindingPrompt(finding: Finding): string {
  const category = OWASP_CATEGORIES[finding.category]?.name ?? finding.category;

  return [
    `Fix this security vulnerability found on my website:`,
    ``,
    `Issue: ${finding.title}`,
    `Severity: ${finding.severity}`,
    `OWASP Category: ${category}`,
    `Description: ${finding.description}`,
    ...(finding.evidence ? [`Evidence:\n${finding.evidence}`] : []),
    ``,
    `Please provide:`,
    `1. The specific code or server configuration to fix this issue`,
    `2. Step-by-step implementation guide`,
    `3. How to verify the fix is working`,
  ].join("\n");
}

export function generateAllFindingsPrompt(findings: Finding[], domain?: string): string {
  const target = domain ? `on ${domain}` : "on my website";
  const sorted = [...findings].sort((a, b) => {
    const order = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"];
    return order.indexOf(a.severity) - order.indexOf(b.severity);
  });

  const issueList = sorted
    .map((f, i) => {
      const category = OWASP_CATEGORIES[f.category]?.name ?? f.category;
      const lines = [
        `[${i + 1}] ${f.title}`,
        `    Severity: ${f.severity} | Category: ${category}`,
        `    ${f.description}`,
      ];
      if (f.evidence) {
        lines.push(`    Evidence: ${f.evidence.split("\n")[0]}`);
      }
      return lines.join("\n");
    })
    .join("\n\n");

  return [
    `I ran an OWASP Top 10 security scan ${target} and found ${findings.length} security ${findings.length === 1 ? "issue" : "issues"}.`,
    `Please help me fix all of them, starting with the most critical.`,
    ``,
    `---`,
    ``,
    issueList,
    ``,
    `---`,
    ``,
    `For each issue provide:`,
    `1. Specific code or server configuration fix`,
    `2. Step-by-step implementation guide`,
    `3. How to verify it is working`,
  ].join("\n");
}
