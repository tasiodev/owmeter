import IORedis from "ioredis";

let _redis: IORedis | null = null;

function getRedis(): IORedis {
  if (!_redis) {
    _redis = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6380", {
      maxRetriesPerRequest: null,
    });
  }
  return _redis;
}

// Atomic fixed-window counter via Lua script.
// Returns the current request count after incrementing.
const INCR_SCRIPT = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return current
`;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter: number; // seconds until window resets (0 when allowed)
}

/**
 * Fixed-window rate limiter backed by Redis.
 * @param key     Unique key identifying the resource + caller (e.g. "rl:trigger_scan:{projectId}")
 * @param limit   Max requests per window
 * @param windowSecs  Window duration in seconds
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSecs: number
): Promise<RateLimitResult> {
  const redis = getRedis();
  const count = (await redis.eval(INCR_SCRIPT, 1, key, String(windowSecs))) as number;

  if (count > limit) {
    const ttl = await redis.ttl(key);
    return { allowed: false, remaining: 0, retryAfter: ttl > 0 ? ttl : windowSecs };
  }

  return { allowed: true, remaining: limit - count, retryAfter: 0 };
}
