export type Severity = "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export const SEVERITY_POINT_LOSS: Record<Severity, number> = {
  INFO: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 4,
  CRITICAL: 6,
};
