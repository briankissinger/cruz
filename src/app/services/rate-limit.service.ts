import { injectable } from 'inversify';
import { HTTP_STATUS, ERROR_CODES } from '../../config/constants.js';
import { getConfig } from '../../config/env.js';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
}

@injectable()
export class RateLimitService {
  private requestCounts: Map<string, { count: number; resetTime: number }> = new Map();

  async checkRateLimit(apiKey: string): Promise<RateLimitResult> {
    const config = getConfig();
    const windowMs = config.RATE_LIMIT_WINDOW_MS;
    const maxRequests = config.RATE_LIMIT_MAX_REQUESTS;
    const now = Date.now();

    const record = this.requestCounts.get(apiKey);

    if (!record || now > record.resetTime) {
      this.requestCounts.set(apiKey, {
        count: 1,
        resetTime: now + windowMs,
      });

      return {
        allowed: true,
        remaining: maxRequests - 1,
        resetTime: now + windowMs,
      };
    }

    record.count += 1;

    if (record.count > maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: record.resetTime,
      };
    }

    return {
      allowed: true,
      remaining: maxRequests - record.count,
      resetTime: record.resetTime,
    };
  }

  getRateLimitHeaders(apiKey: string): { limit: number; remaining: number; reset: number } {
    const config = getConfig();
    const maxRequests = config.RATE_LIMIT_MAX_REQUESTS;
    const now = Date.now();
    const record = this.requestCounts.get(apiKey);

    if (!record) {
      return { limit: maxRequests, remaining: maxRequests, reset: now + config.RATE_LIMIT_WINDOW_MS };
    }

    return {
      limit: maxRequests,
      remaining: Math.max(0, maxRequests - record.count),
      reset: record.resetTime,
    };
  }

  resetRateLimit(apiKey: string): void {
    this.requestCounts.delete(apiKey);
  }
}