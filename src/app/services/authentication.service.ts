import { inject, injectable } from 'inversify';
import { TYPES } from '../../infra/config/inversify.config.js';
import type { ICustomerRepository } from '../../core/interfaces/repository/index.js';
import type { ISessionRepository } from '../../core/interfaces/repository/index.js';
import { CustomerEntity } from '../../core/domain/customer.entity.js';
import { SessionEntity, SessionStatusEnum } from '../../core/domain/session.entity.js';
import { HTTP_STATUS, ERROR_CODES } from '../../config/constants.js';
import { getConfig } from '../../config/env.js';
import { uuidv7 } from 'uuidv7';

export interface TokenPayload {
  sub: string;
  clientId: string;
  customerId?: string;
  type: 'access' | 'refresh';
  iat: number;
  exp: number;
  iss: string;
  aud: string;
  jti: string;
  evictToken?: boolean;
}

export interface AuthenticationResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

export interface AuthenticationValidationResult {
  isValid: boolean;
  userId?: string;
  customerId?: string;
  clientId?: string;
  error?: string;
  errorCode?: string;
  statusCode?: number;
}

@injectable()
export class AuthenticationService {
  constructor(
    @inject(TYPES.CustomerRepository) private customerRepository: ICustomerRepository,
    @inject(TYPES.SessionRepository) private sessionRepository: ISessionRepository,
  ) {}

  async authenticateWithBasicAuth(
    clientId: string,
    clientSecret: string,
    evictToken?: boolean,
  ): Promise<AuthenticationResult> {
    const customer = await this.customerRepository.findByClientId(clientId);
    if (!customer) {
      throw new ApplicationError('Invalid client credentials', ERROR_CODES.AUTHENTICATION_FAILED, HTTP_STATUS.UNAUTHORIZED);
    }

    const isSecretValid = customer.clientSecret === clientSecret;
    if (!isSecretValid) {
      throw new ApplicationError('Invalid client credentials', ERROR_CODES.AUTHENTICATION_FAILED, HTTP_STATUS.UNAUTHORIZED);
    }

    if (evictToken) {
      await this.sessionRepository.revokeAllByUserId(customer.userId);
    }

    const { accessToken, refreshToken, expiresIn } = await this.generateTokenPair(customer);

    const config = getConfig();
    const atHash = await this.hashToken(accessToken);
    const rtHash = await this.hashToken(refreshToken);

    const session = SessionEntity.create({
      userId: customer.userId,
      accessTokenHash: atHash,
      refreshTokenHash: rtHash,
      accessTokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
      refreshTokenExpiresAt: new Date(Date.now() + expiresIn * 1000 * 7),
      status: SessionStatusEnum.ACTIVE,
    });

    await this.sessionRepository.create(session);

    return {
      accessToken,
      refreshToken,
      expiresIn,
      tokenType: 'Bearer',
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<AuthenticationResult> {
    const rtHash = await this.hashToken(refreshToken);
    const session = await this.sessionRepository.findByRefreshTokenHash(rtHash);

    if (!session) {
      throw new ApplicationError('Invalid refresh token', ERROR_CODES.AUTHENTICATION_FAILED, HTTP_STATUS.UNAUTHORIZED);
    }

    if (!session.isActive()) {
      throw new ApplicationError('Refresh token expired or revoked', ERROR_CODES.TOKEN_EXPIRED, HTTP_STATUS.UNAUTHORIZED);
    }

    const customer = await this.customerRepository.findByUserId(session.userId);
    if (!customer) {
      throw new ApplicationError('Customer not found', ERROR_CODES.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
    }

    const { accessToken, expiresIn } = await this.generateAccessToken(customer);

    session.updatedAt = new Date();
    await this.sessionRepository.update(session);

    return {
      accessToken,
      refreshToken,
      expiresIn,
      tokenType: 'Bearer',
    };
  }

  async validateAccessToken(token: string): Promise<AuthenticationValidationResult> {
    try {
      const config = getConfig();
      const { verify } = await import('jsonwebtoken');
      const decoded = verify(token, config.JWT_PUBLIC_KEY, {
        algorithms: ['RS256'],
        issuer: config.JWT_ISSUER,
        audience: config.JWT_AUDIENCE,
      }) as TokenPayload;

      if (decoded.type !== 'access') {
        return {
          isValid: false,
          error: 'Invalid token type',
          errorCode: ERROR_CODES.AUTHENTICATION_FAILED,
          statusCode: HTTP_STATUS.UNAUTHORIZED,
        };
      }

      const atHash = await this.hashToken(token);
      const session = await this.sessionRepository.findByAccessTokenHash(atHash);

      if (!session) {
        return {
          isValid: false,
          error: 'Session not found',
          errorCode: ERROR_CODES.AUTHENTICATION_FAILED,
          statusCode: HTTP_STATUS.UNAUTHORIZED,
        };
      }

      if (session.status !== SessionStatusEnum.ACTIVE) {
        return {
          isValid: false,
          error: 'Token has been revoked or blacklisted',
          errorCode: ERROR_CODES.TOKEN_BLACKLISTED,
          statusCode: HTTP_STATUS.UNAUTHORIZED,
        };
      }

      return {
        isValid: true,
        userId: decoded.sub,
        customerId: decoded.customerId,
        clientId: decoded.clientId,
      };
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        return {
          isValid: false,
          error: 'Token has expired',
          errorCode: ERROR_CODES.TOKEN_EXPIRED,
          statusCode: HTTP_STATUS.UNAUTHORIZED,
        };
      }
      return {
        isValid: false,
        error: 'Invalid token',
        errorCode: ERROR_CODES.AUTHENTICATION_FAILED,
        statusCode: HTTP_STATUS.UNAUTHORIZED,
      };
    }
  }

  async revokeToken(accessToken: string): Promise<void> {
    const atHash = await this.hashToken(accessToken);
    await this.sessionRepository.blacklistByAccessTokenHash(atHash);
  }

  async evictAllSessions(customerId: string): Promise<void> {
    await this.sessionRepository.revokeAllByUserId(customerId as any);
  }

  private async generateTokenPair(customer: CustomerEntity): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    const accessToken = await this.generateAccessToken(customer);
    const refreshToken = await this.generateRefreshToken(customer);
    return { ...accessToken, refreshToken };
  }

  private async generateAccessToken(customer: CustomerEntity): Promise<{ accessToken: string; expiresIn: number }> {
    const config = getConfig();
    const { sign } = await import('jsonwebtoken');

    const expiresIn = 3600;
    const payload: Omit<TokenPayload, 'iat' | 'exp'> = {
      sub: customer.userId,
      clientId: customer.clientId,
      customerId: customer.id,
      type: 'access',
      iss: config.JWT_ISSUER,
      aud: config.JWT_AUDIENCE,
      jti: uuidv7(),
    };

    const accessToken = sign(payload, config.JWT_PRIVATE_KEY, {
      algorithm: 'RS256',
      expiresIn,
    });

    return { accessToken, expiresIn };
  }

  private async generateRefreshToken(customer: CustomerEntity): Promise<string> {
    const config = getConfig();
    const { sign } = await import('jsonwebtoken');

    const payload: Omit<TokenPayload, 'iat' | 'exp'> = {
      sub: customer.userId,
      clientId: customer.clientId,
      customerId: customer.id,
      type: 'refresh',
      iss: config.JWT_ISSUER,
      aud: config.JWT_AUDIENCE,
      jti: uuidv7(),
    };

    const refreshToken = sign(payload, config.JWT_PRIVATE_KEY, {
      algorithm: 'RS256',
      expiresIn: '7d',
    });

    return refreshToken;
  }

  private async hashToken(token: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(token);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
}

export class ApplicationError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: string;

  constructor(message: string, errorCode: string, statusCode: number) {
    super(message);
    this.name = 'ApplicationError';
    this.errorCode = errorCode;
    this.statusCode = statusCode;
  }
}