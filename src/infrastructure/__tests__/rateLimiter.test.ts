import { describe, it, expect, vi, beforeEach } from "vitest";

const mockEval = vi.fn();
const mockTtl = vi.fn();

vi.mock("ioredis", () => {
  function MockIORedis() {
    return { eval: mockEval, ttl: mockTtl };
  }
  return { default: MockIORedis };
});

// Import after mocking so the singleton picks up the mock
const { checkRateLimit } = await import("../rateLimiter");

describe("checkRateLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows request when count is within limit", async () => {
    mockEval.mockResolvedValue(3);

    const result = await checkRateLimit("rl:test:proj1", 10, 3600);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(7);
    expect(result.retryAfter).toBe(0);
  });

  it("allows request exactly at the limit", async () => {
    mockEval.mockResolvedValue(10);

    const result = await checkRateLimit("rl:test:proj1", 10, 3600);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(0);
  });

  it("blocks request when count exceeds limit", async () => {
    mockEval.mockResolvedValue(11);
    mockTtl.mockResolvedValue(1800);

    const result = await checkRateLimit("rl:test:proj1", 10, 3600);

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfter).toBe(1800);
  });

  it("uses windowSecs as retryAfter when TTL returns -1", async () => {
    mockEval.mockResolvedValue(11);
    mockTtl.mockResolvedValue(-1);

    const result = await checkRateLimit("rl:test:proj1", 10, 3600);

    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBe(3600);
  });

  it("passes the correct key, count and window to Redis", async () => {
    mockEval.mockResolvedValue(1);

    await checkRateLimit("rl:trigger_scan:abc123", 5, 60);

    expect(mockEval).toHaveBeenCalledWith(
      expect.any(String), // Lua script
      1,
      "rl:trigger_scan:abc123",
      "60"
    );
  });
});
