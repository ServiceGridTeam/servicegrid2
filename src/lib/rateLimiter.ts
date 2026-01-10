/**
 * Client-side rate limiting utility for L5 hardening
 * Prevents abuse by throttling operations on the client
 */

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

class RateLimiter {
  private requests: number[] = [];
  private name: string;

  constructor(private config: RateLimitConfig, name = 'default') {
    this.name = name;
  }

  canMakeRequest(): boolean {
    const now = Date.now();
    this.requests = this.requests.filter((t) => now - t < this.config.windowMs);
    return this.requests.length < this.config.maxRequests;
  }

  recordRequest(): void {
    this.requests.push(Date.now());
  }

  getRemainingRequests(): number {
    const now = Date.now();
    this.requests = this.requests.filter((t) => now - t < this.config.windowMs);
    return Math.max(0, this.config.maxRequests - this.requests.length);
  }

  getResetTimeMs(): number {
    if (this.requests.length === 0) return 0;
    const oldestRequest = this.requests[0];
    const resetAt = oldestRequest + this.config.windowMs;
    return Math.max(0, resetAt - Date.now());
  }

  getResetTimeMinutes(): number {
    return Math.ceil(this.getResetTimeMs() / 60000);
  }

  isNearLimit(threshold = 0.2): boolean {
    const remaining = this.getRemainingRequests();
    return remaining <= this.config.maxRequests * threshold;
  }

  reset(): void {
    this.requests = [];
  }
}

// Rate limits per spec:
// - 20 tags/hour for tag creation
// - 100 operations/min for general tag operations
// - 100 queries/min for search

export const tagCreationLimiter = new RateLimiter(
  { maxRequests: 20, windowMs: 60 * 60 * 1000 }, // 20 per hour
  'tag-creation'
);

export const tagOperationLimiter = new RateLimiter(
  { maxRequests: 100, windowMs: 60 * 1000 }, // 100 per minute
  'tag-operation'
);

export const searchLimiter = new RateLimiter(
  { maxRequests: 100, windowMs: 60 * 1000 }, // 100 per minute
  'search'
);

export type { RateLimitConfig };
export { RateLimiter };
