/**
 * Minimal in-memory sliding-window rate limiter.
 * Appropriate for the single-process stall deployment (see README); not
 * intended for multi-instance production clusters.
 */
interface Window {
  timestamps: number[];
}

const windows = new Map<string, Window>();

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  const entry = windows.get(key) ?? { timestamps: [] };
  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);
  if (entry.timestamps.length >= limit) {
    windows.set(key, entry);
    const oldest = entry.timestamps[0] ?? now;
    return { ok: false, retryAfterSec: Math.ceil((windowMs - (now - oldest)) / 1000) };
  }
  entry.timestamps.push(now);
  windows.set(key, entry);
  return { ok: true, retryAfterSec: 0 };
}

export function clientKey(request: Request, scope: string): string {
  const fwd = request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "local";
  return `${scope}:${fwd.split(",")[0]?.trim() ?? "local"}`;
}
