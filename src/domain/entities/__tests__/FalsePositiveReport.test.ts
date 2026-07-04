import { describe, it, expect } from "vitest";
import { fpKey, extractFilePath } from "../FalsePositiveReport";

describe("fpKey", () => {
  it("concatenates category, title and filePath with colons", () => {
    expect(fpKey("A05_INJECTION", "SQL Injection", "src/db.ts")).toBe(
      "A05_INJECTION:SQL Injection:src/db.ts"
    );
  });

  it("produces a stable key with an empty filePath", () => {
    expect(fpKey("A02_SECURITY_MISCONFIGURATION", "Missing CSP", "")).toBe(
      "A02_SECURITY_MISCONFIGURATION:Missing CSP:"
    );
  });

  it("two reports with the same inputs produce equal keys", () => {
    const a = fpKey("A01_BROKEN_ACCESS_CONTROL", "Broken Auth", "src/auth.ts");
    const b = fpKey("A01_BROKEN_ACCESS_CONTROL", "Broken Auth", "src/auth.ts");
    expect(a).toBe(b);
  });

  it("different filePaths produce different keys", () => {
    const a = fpKey("A05_INJECTION", "XSS", "src/a.tsx");
    const b = fpKey("A05_INJECTION", "XSS", "src/b.tsx");
    expect(a).not.toBe(b);
  });
});

describe("extractFilePath", () => {
  it("extracts file path from evidence using em-dash separator", () => {
    expect(extractFilePath("src/components/Login.tsx:42 — password = 'Secret123!'")).toBe(
      "src/components/Login.tsx"
    );
  });

  it("extracts file path from evidence using hyphen separator", () => {
    expect(extractFilePath("src/utils/db.ts:10 - SELECT * FROM users")).toBe(
      "src/utils/db.ts"
    );
  });

  it("handles nested directory paths", () => {
    expect(extractFilePath("src/app/[locale]/page.tsx:5 — dangerouslySetInnerHTML")).toBe(
      "src/app/[locale]/page.tsx"
    );
  });

  it("returns empty string for passive/web evidence with no file:line pattern", () => {
    expect(extractFilePath("Header value: X-Frame-Options missing")).toBe("");
  });

  it("returns empty string for null", () => {
    expect(extractFilePath(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(extractFilePath(undefined)).toBe("");
  });

  it("returns empty string for empty string", () => {
    expect(extractFilePath("")).toBe("");
  });
});
