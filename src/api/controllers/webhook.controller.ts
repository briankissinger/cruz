import { inject } from 'inversify';
import { Controller, Get, Post, Delete, Request as request, Response as response, Next as next } from '@inversifyjs/http-core';
import type { Request, Response, NextFunction } from 'express';
import { TYPES } from '../../infra/config/inversify.config.js';
import { validationPipe } from '../pipes/index.js';
import { exceptionFilter } from '../filters/index.js';
import { HTTP_STATUS, ERROR_CODES } from '../../config/constants.js';
import { logger } from '../middlewares/index.js';

@Controller('/health')
export class HealthController {
  /**
   * @openapi
   * /health:
   *   get:
   *     tags: [Health]
   *     summary: Health check endpoint
   *     responses:
   *       200:
   *         description: Service is healthy
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 status:
   *                   type: string
   *                 timestamp:
   *                   type: string
   *                   format: date-time
   *                 service:
   *                   type: string
   */
  @Get('/')
  async healthCheck(@request() req: any, @response() res: any): Promise<void> {
    res.status(HTTP_STATUS.OK).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'cruz-payment-gateway',
    });
  }
}

export interface TenantWebhookRegistration {
  customerId: string;
  webhookUrl: string;
  secret: string;
  events: string[];
  isActive: boolean;
}

const tenantWebhooks: Map<string, TenantWebhookRegistration[]> = new Map();

@Controller('/api/v1/webhooks/tenant')
export class WebhookController {
  constructor(
    @inject(TYPES.ValidationPipe) private validate: validationPipe,
    @inject(TYPES.ExceptionFilter) private exceptionFilter: exceptionFilter,
  ) {}

  /**
   * @openapi
   * /api/v1/webhooks/tenant:
   *   post:
   *     tags: [Webhooks]
   *     summary: Register a tenant webhook
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - webhookUrl
   *               - secret
   *               - events
   *             properties:
   *               webhookUrl:
   *                 type: string
   *               secret:
   *                 type: string
   *                 minLength: 16
   *               events:
   *                 type: array
   *                 items:
   *                   type: string
   *     responses:
   *       201:
   *         description: Webhook registered successfully
   *       422:
   *         description: Validation error
   */
  @Post('/')
  async registerWebhook(@request() req: Request, @response() res: Response, @next() nxt: NextFunction): Promise<void> {
    try {
      const customerId = (req as any).user?.customerId;
      const body = req.body;

      const validation = await this.validate.transform(body, {
        webhookUrl: { required: true, type: 'string' },
        secret: { required: true, type: 'string', minLength: 16 },
        events: { required: true },
      });

      if (validation.error) {
        res.status(HTTP_STATUS.UNPROCESSABLE_ENTITY).json({ error: ERROR_CODES.VALIDATION_ERROR, message: validation.error });
        return;
      }

      if (!Array.isArray(body.events) || body.events.length === 0) {
        res.status(HTTP_STATUS.UNPROCESSABLE_ENTITY).json({ error: ERROR_CODES.VALIDATION_ERROR, message: 'At least one event must be specified' });
        return;
      }

      const registration: TenantWebhookRegistration = {
        customerId,
        webhookUrl: body.webhookUrl,
        secret: body.secret,
        events: body.events,
        isActive: true,
      };

      const existing = tenantWebhooks.get(customerId) || [];
      existing.push(registration);
      tenantWebhooks.set(customerId, existing);

      logger.info({ customerId, webhookUrl: body.webhookUrl, events: body.events }, 'tenant webhook registered');

      res.status(HTTP_STATUS.CREATED).json({
        message: 'Webhook registered successfully',
        webhookUrl: body.webhookUrl,
        events: body.events,
      });
    } catch (error) {
      this.exceptionFilter.catch(error, req, res, nxt);
    }
  }

  /**
   * @openapi
   * /api/v1/webhooks/tenant:
   *   get:
   *     tags: [Webhooks]
   *     summary: List tenant webhooks
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: List of registered webhooks
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/TenantWebhookRegistration'
   */
  @Get('/')
  async listWebhooks(@request() req: Request, @response() res: Response, @next() nxt: NextFunction): Promise<void> {
    try {
      const customerId = (req as any).user?.customerId;
      const webhooks = tenantWebhooks.get(customerId) || [];
      res.status(HTTP_STATUS.OK).json({ data: webhooks });
    } catch (error) {
      this.exceptionFilter.catch(error, req, res, nxt);
    }
  }

  /**
   * @openapi
   * /api/v1/webhooks/tenant:
   *   delete:
   *     tags: [Webhooks]
   *     summary: Delete a tenant webhook
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               webhookUrl:
   *                 type: string
   *     responses:
   *       200:
   *         description: Webhook deleted successfully
   */
  @Delete('/')
  async deleteWebhook(@request() req: Request, @response() res: Response, @next() nxt: NextFunction): Promise<void> {
    try {
      const customerId = (req as any).user?.customerId;
      const webhookUrl = req.params.webhookUrl || req.body.webhookUrl;

      const existing = tenantWebhooks.get(customerId) || [];
      const filtered = existing.filter((w) => w.webhookUrl !== webhookUrl);
      tenantWebhooks.set(customerId, filtered);

      res.status(HTTP_STATUS.OK).json({ message: 'Webhook deleted successfully' });
    } catch (error) {
      this.exceptionFilter.catch(error, req, res, nxt);
    }
  }

  static getTenantWebhooks(customerId: string): TenantWebhookRegistration[] {
    return tenantWebhooks.get(customerId) || [];
  }

  static getAllWebhooks(): Map<string, TenantWebhookRegistration[]> {
    return tenantWebhooks;
  }
}
