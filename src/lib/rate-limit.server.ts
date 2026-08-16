// Lightweight in-memory rate limiter for brute-force protection on public
// server functions (e.g. student PIN sign-in).
//
// WARNING: state is per-process. Deployments with multiple instances do not
// share the counter, so treat this as a first line of defense and complement
// it with a distributed store (Redis/Postgres) or edge protection when scaling.

type Bucket = {
  count: number;
  resetAt: number;
  lockedUntil?: number;
};

const buckets = new Map<string, Bucket>();

function sweep() {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if ((bucket.lockedUntil ?? 0) < now && bucket.resetAt < now) {
      buckets.delete(key);
    }
  }
}

export function rateLimit(options: {
  key: string;
  maxAttempts: number;
  windowMs: number;
  lockMs?: number;
}): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const bucket = buckets.get(options.key);

  if (bucket) {
    if (bucket.lockedUntil && bucket.lockedUntil > now) {
      return { allowed: false, retryAfterMs: bucket.lockedUntil - now };
    }
    if (now > bucket.resetAt) {
      bucket.count = 0;
      bucket.resetAt = now + options.windowMs;
      bucket.lockedUntil = undefined;
    }
  }

  const current = bucket ?? { count: 0, resetAt: now + options.windowMs };
  current.count += 1;

  if (current.count > options.maxAttempts) {
    if (options.lockMs) current.lockedUntil = now + options.lockMs;
    current.resetAt = now + options.windowMs;
    buckets.set(options.key, current);
    sweep();
    return { allowed: false, retryAfterMs: options.lockMs };
  }

  buckets.set(options.key, current);
  sweep();
  return { allowed: true };
}
