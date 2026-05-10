import { describe, it, expect, vi, afterEach } from "vitest";
import { zipSync, strToU8 } from "fflate";
import { applySastFindings, VerificationError } from "../scanQueue";
import type { RawFinding } from "@/domain/services/ScoringService";

vi.mock("@/infrastructure/scanning/SourceCodeAnalyzer", () => ({
  runSourceCodeAnalysis: vi.fn().mockResolvedValue([
    {
      category: "A03_INJECTION",
      severity: "CRITICAL",
      title: "eval() usage",
      description: "eval() is dangerous",
    },
  ]),
}));

function makeZip(files: Record<string, string>): Uint8Array {
  const input: Record<string, Uint8Array> = {};
  for (const [k, v] of Object.entries(files)) {
    input[k] = strToU8(v);
  }
  return zipSync(input);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("applySastFindings", () => {
  it("throws VerificationError when code does not match the target site", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    const zip = makeZip({ "package.json": JSON.stringify({ name: "some-other-app" }) });
    const combined: RawFinding[] = [];

    await expect(
      applySastFindings(combined, zip, "https://example.com", null)
    ).rejects.toThrow(VerificationError);
    expect(combined).toHaveLength(0);
  });

  it("appends SAST findings when verification passes", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    const zip = makeZip({
      "package.json": JSON.stringify({ homepage: "https://example.com" }),
    });
    const combined: RawFinding[] = [];

    await applySastFindings(combined, zip, "https://example.com", null);

    expect(combined.length).toBeGreaterThan(0);
    expect(combined[0].title).toBe("eval() usage");
  });

  it("does not append any findings when verification fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    const zip = makeZip({ "readme.md": "unrelated project" });
    const combined: RawFinding[] = [];

    await expect(
      applySastFindings(combined, zip, "https://example.com", null)
    ).rejects.toBeInstanceOf(VerificationError);
    expect(combined).toHaveLength(0);
  });
});
