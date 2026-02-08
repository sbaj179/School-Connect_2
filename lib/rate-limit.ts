const rateMap = new Map<string, { count: number; expiresAt: number }>();

export function checkRateLimit(key: string, options?: { limit?: number; windowMs?: number }) {
  const limit = options?.limit ?? 8;
  const windowMs = options?.windowMs ?? 60_000;
  const now = Date.now();
  const current = rateMap.get(key);

  if (!current || current.expiresAt < now) {
    rateMap.set(key, { count: 1, expiresAt: now + windowMs });
    return { allowed: true, remaining: limit - 1 };
  }

  if (current.count >= limit) {
    return { allowed: false, remaining: 0 };
  }

  current.count += 1;
  return { allowed: true, remaining: Math.max(limit - current.count, 0) };
}
