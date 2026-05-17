import pino from "pino";

// Default to "warn" in production so routine scan progress doesn't flood logs.
// Set LOG_LEVEL=info (or debug) to enable verbose output.
const defaultLevel = process.env.NODE_ENV === "production" ? "warn" : "info";
const level = process.env.LOG_LEVEL ?? defaultLevel;

export function createLogger(name: string) {
  return pino({ name, level });
}
