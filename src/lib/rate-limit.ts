// Minimal in-memory sliding-window limiter for the AI routes. Good enough for a
// single-instance demo; use a shared store (e.g. Redis) when scaling out.
const hits = new Map<string, number[]>();

export function rateLimit(key: string, limit = Number(process.env.AI_RATE_LIMIT_PER_MINUTE) || 20, windowMs = 60_000) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return { ok: false, retryAfter: Math.ceil((windowMs - (now - recent[0])) / 1000) };
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 10_000) hits.clear();
  return { ok: true, retryAfter: 0 };
}

export function clientKey(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}
