type RateLimitEntry = {
  count: number;
  resetAt: number;
};

declare global {
  var __dreamshiftRateLimitStore: Map<string, RateLimitEntry> | undefined;
}

const store = globalThis.__dreamshiftRateLimitStore || new Map<string, RateLimitEntry>();
globalThis.__dreamshiftRateLimitStore = store;

export function checkRateLimit(key: string, maxRequests: number, windowMs: number) {
  const now = Date.now();
  const existing = store.get(key);

  if (!existing || now >= existing.resetAt) {
    const resetAt = now + windowMs;
    store.set(key, { count: 1, resetAt });
    return {
      allowed: true,
      remaining: Math.max(0, maxRequests - 1),
      resetAt,
    };
  }

  if (existing.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: existing.resetAt,
    };
  }

  existing.count += 1;
  store.set(key, existing);

  return {
    allowed: true,
    remaining: Math.max(0, maxRequests - existing.count),
    resetAt: existing.resetAt,
  };
}