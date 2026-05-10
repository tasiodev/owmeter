import { describe, it, expect } from "vitest";
import { SEVERITY_POINT_LOSS } from "../Severity";

describe("SEVERITY_POINT_LOSS", () => {
  it("INFO costs 0 points", () => expect(SEVERITY_POINT_LOSS.INFO).toBe(0));
  it("LOW costs 1 point", () => expect(SEVERITY_POINT_LOSS.LOW).toBe(1));
  it("MEDIUM costs 2 points", () => expect(SEVERITY_POINT_LOSS.MEDIUM).toBe(2));
  it("HIGH costs 4 points", () => expect(SEVERITY_POINT_LOSS.HIGH).toBe(4));
  it("CRITICAL costs 6 points", () => expect(SEVERITY_POINT_LOSS.CRITICAL).toBe(6));

  it("severity is ordered (INFO < LOW < MEDIUM < HIGH < CRITICAL)", () => {
    expect(SEVERITY_POINT_LOSS.INFO).toBeLessThan(SEVERITY_POINT_LOSS.LOW);
    expect(SEVERITY_POINT_LOSS.LOW).toBeLessThan(SEVERITY_POINT_LOSS.MEDIUM);
    expect(SEVERITY_POINT_LOSS.MEDIUM).toBeLessThan(SEVERITY_POINT_LOSS.HIGH);
    expect(SEVERITY_POINT_LOSS.HIGH).toBeLessThan(SEVERITY_POINT_LOSS.CRITICAL);
  });
});
