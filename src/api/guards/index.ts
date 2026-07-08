import { inject, injectable } from 'inversify';
import { TYPES } from '../../infra/config/inversify.config.js';
import { AuthenticationService } from '../../app/services/authentication.service.js';
import { ApiKeyService } from '../../app/services/api-key.service.js';
import { RateLimitService } from '../../app/services/rate-limit.service.js';
import type { Request, Response, NextFunction } from 'express';

export interface GuardResult {
  allowed: boolean;
  error?: string;
  statusCode?: number;
}

@injectable()
export class authGuard {
  constructor(
    @inject(TYPES.AuthenticationService) private authService: AuthenticationService,
  ) {}

  async guard(request: Request): Promise<GuardResult> {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      return { allowed: false, error: 'Missing authorization header', statusCode: 401 };
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return { allowed: false, error: 'Invalid authorization header format', statusCode: 401 };
    }

    const token = parts[1];
    const validation = await this.authService.validateAccessToken(token);

    if (!validation.isValid) {
      return { allowed: false, error: validation.error, statusCode: validation.statusCode };
    }

    (request as any).user = {
      userId: validation.userId,
      customerId: validation.customerId,
      clientId: validation.clientId,
    };

    return { allowed: true };
  }
}

@injectable()
export class apiKeyGuard {
  constructor(
    @inject(TYPES.ApiKeyService) private apiKeyService: ApiKeyService,
  ) {}

  async guard(request: Request): Promise<GuardResult> {
    const apiKey = request.headers['x-api-key'] as string;
    if (!apiKey) {
      return { allowed: false, error: 'Missing API key header', statusCode: 403 };
    }

    const result = await this.apiKeyService.validateApiKey(apiKey);
    if (!result.isValid) {
      return { allowed: false, error: result.error || 'Invalid API key', statusCode: 403 };
    }

    (request as any).customer = result.customer;
    return { allowed: true };
  }
}

@injectable()
export class rateLimitGuard {
  constructor(
    @inject(TYPES.RateLimitService) private rateLimitService: RateLimitService,
  ) {}

  async guard(request: Request): Promise<GuardResult> {
    const apiKey = (request.headers['x-api-key'] as string) || (request as any).customer?.apiKey || 'anonymous';
    const result = await this.rateLimitService.checkRateLimit(apiKey);

    if (!result.allowed) {
      return { allowed: false, error: 'Rate limit exceeded', statusCode: 429 };
    }

    return { allowed: true };
  }
}

@injectable()
export class permissionGuard {
  constructor() {}

  async guard(request: Request, requiredPermissions: string[]): Promise<GuardResult> {
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return { allowed: true };
    }

    const user = (request as any).user;
    if (!user) {
      return { allowed: false, error: 'User not authenticated', statusCode: 401 };
    }

    return { allowed: true };
  }
}