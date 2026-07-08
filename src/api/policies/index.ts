import { inject, injectable } from 'inversify';
import { TYPES } from '../../infra/config/inversify.config.js';
import { ApiKeyService } from '../../app/services/api-key.service.js';
import { AuthenticationService } from '../../app/services/authentication.service.js';
import type { Request } from 'express';

export interface PolicyResult {
  allowed: boolean;
  error?: string;
  statusCode?: number;
}

@injectable()
export class apiKeyPolicy {
  constructor(
    @inject(TYPES.ApiKeyService) private apiKeyService: ApiKeyService,
  ) {}

  async enforce(request: Request): Promise<PolicyResult> {
    const apiKey = request.headers['x-api-key'] as string;
    if (!apiKey) {
      return { allowed: false, error: 'API key is required', statusCode: 403 };
    }

    const result = await this.apiKeyService.validateApiKey(apiKey);
    if (!result.isValid) {
      return { allowed: false, error: result.error || 'Invalid or blacklisted API key', statusCode: 403 };
    }

    (request as any).customer = result.customer;
    return { allowed: true };
  }
}

@injectable()
export class tokenPolicy {
  constructor(
    @inject(TYPES.AuthenticationService) private authService: AuthenticationService,
  ) {}

  async enforce(request: Request): Promise<PolicyResult> {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      return { allowed: false, error: 'Bearer token is required', statusCode: 401 };
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return { allowed: false, error: 'Invalid authorization format. Use: Bearer <token>', statusCode: 401 };
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

  async enforceOptional(request: Request): Promise<PolicyResult> {
    const authHeader = request.headers.authorization;
    if (!authHeader) return { allowed: true };

    return this.enforce(request);
  }
}

@injectable()
export class tenantPolicy {
  constructor() {}

  async enforce(request: Request, requiredTenantId?: string): Promise<PolicyResult> {
    const user = (request as any).user;
    const customer = (request as any).customer;

    if (!user && !customer) {
      return { allowed: false, error: 'Authentication required', statusCode: 401 };
    }

    if (requiredTenantId) {
      const tenantId = user?.customerId || customer?.id;
      if (tenantId !== requiredTenantId) {
        return { allowed: false, error: 'Access denied to this resource', statusCode: 403 };
      }
    }

    return { allowed: true };
  }
}