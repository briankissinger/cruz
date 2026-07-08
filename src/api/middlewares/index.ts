import type { Request, Response, NextFunction } from 'express';
import pino from 'pino';
import { getConfig } from '../../config/env.js';
import { APP_CONSTANTS } from '../../config/constants.js';
import { uuidv7 } from 'uuidv7';
import type { ExpressMiddleware } from '@inversifyjs/http-express';
import { injectable } from 'inversify';

const config = getConfig();
const isDev = config.NODE_ENV === 'development';

const baseOptions: pino.LoggerOptions = {
  level: config.PINO_LOG_LEVEL,
  name: APP_CONSTANTS.APP_NAME,
};

let logger: pino.Logger;

if (isDev) {
  logger = pino({
    ...baseOptions,
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    },
  });
} else {
  const targets: pino.TransportTargetOptions[] = [
    {
      target: 'pino-roll',
      options: {
        file: config.PINO_LOG_FILE || './logs/cruz.log',
        frequency: 'daily',
        size: '10m',
        mkdir: true,
      },
    },
  ];

  if (config.PINO_LOKI_HOST) {
    targets.push({
      target: 'pino-loki',
      options: {
        host: `http://${config.PINO_LOKI_HOST}:${config.PINO_LOKI_PORT || 3100}`,
        basicAuth: config.PINO_LOKI_USERNAME && config.PINO_LOKI_PASSWORD
          ? { username: config.PINO_LOKI_USERNAME, password: config.PINO_LOKI_PASSWORD }
          : undefined,
        labels: { service: APP_CONSTANTS.APP_NAME },
      },
    });
  }

  const transport = pino.transport({ targets, dedupe: true });
  logger = pino(baseOptions, transport);
}

@injectable()
export class LoggerMiddleware implements ExpressMiddleware {
  public execute(request: Request, response: Response, next: NextFunction): void {
    const start = Date.now();
    const requestId = (request as any).requestId;

    logger.info({
      requestId,
      method: request.method,
      url: request.originalUrl,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    }, 'incoming request');

    response.on('finish', () => {
      const duration = Date.now() - start;
      logger.info({
        requestId,
        method: request.method,
        url: request.originalUrl,
        statusCode: response.statusCode,
        duration,
      }, 'request completed');
    });

    next();
  }
}

@injectable()
export class RequestIdMiddleware implements ExpressMiddleware {
  public execute(request: Request, response: Response, next: NextFunction): void {
    const requestId = (request.headers['x-request-id'] as string) || uuidv7();
    (request as any).requestId = requestId;
    response.setHeader('X-Request-ID', requestId);
    next();
  }
}

@injectable()
export class CorsMiddleware implements ExpressMiddleware  {
  private allowedOrigins: string[];

  constructor() {
    this.allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['*'];
  }

  public execute(request: Request, response: Response, next: NextFunction): void {
    const origin = request.headers.origin;

    if (this.allowedOrigins.includes('*')) {
      response.setHeader('Access-Control-Allow-Origin', '*');
    } else if (origin && this.allowedOrigins.includes(origin)) {
      response.setHeader('Access-Control-Allow-Origin', origin);
    }

    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key, X-Request-ID');
    response.setHeader('Access-Control-Allow-Credentials', 'true');
    response.setHeader('Access-Control-Max-Age', '86400');

    if (request.method === 'OPTIONS') {
      response.status(204).end();
      return;
    }

    next();
  }
}

@injectable()
export class HelmetMiddleware implements ExpressMiddleware {
  public execute(request: Request, response: Response, next: NextFunction): void {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('X-XSS-Protection', '1; mode=block');
    response.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    response.setHeader('Content-Security-Policy', "default-src 'self'");
    response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    next();
  }
}

export { logger };