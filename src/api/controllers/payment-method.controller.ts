import { inject } from 'inversify';
import { Controller, Get, Post, Patch, Request as request, Response as response, Next as next } from '@inversifyjs/http-core';
import type { Request, Response, NextFunction } from 'express';
import { TYPES } from '../../infra/config/inversify.config.js';
import { PaymentMethodService } from '../../app/services/payment-method.service.js';
import { validationPipe } from '../pipes/index.js';
import { exceptionFilter } from '../filters/index.js';
import { HTTP_STATUS, ERROR_CODES } from '../../config/constants.js';

@Controller('/api/v1/payment-methods')
export class PaymentMethodController {
  constructor(
    @inject(TYPES.PaymentMethodService) private paymentMethodService: PaymentMethodService,
    @inject(TYPES.ValidationPipe) private validate: validationPipe,
    @inject(TYPES.ExceptionFilter) private exceptionFilter: exceptionFilter,
  ) {}

  /**
   * @openapi
   * /api/v1/payment-methods:
   *   post:
   *     tags: [Payment Methods]
   *     summary: Create a new payment method
   */
  @Post('/')
  async createPaymentMethod(@request() req: Request, @response() res: Response, @next() nxt: NextFunction): Promise<void> {
    try {
      const body = req.body;
      const validation = await this.validate.transform(body, {
        name: { required: true, type: 'string', minLength: 1 },
        type: { required: true, type: 'string', enum: ['mpesa', 'pesaflow'] },
        testBaseUrl: { required: true, type: 'string' },
        productionBaseUrl: { required: true, type: 'string' },
        config: { required: true },
      });

      if (validation.error) {
        res.status(HTTP_STATUS.UNPROCESSABLE_ENTITY).json({ error: ERROR_CODES.VALIDATION_ERROR, message: validation.error });
        return;
      }

      const typeMap: Record<string, any> = {
        mpesa: 0,
        pesaflow: 1,
      };

      const paymentMethod = await this.paymentMethodService.createPaymentMethod({
        name: body.name,
        description: body.description || '',
        type: typeMap[body.type],
        testBaseUrl: body.testBaseUrl,
        productionBaseUrl: body.productionBaseUrl,
        config: body.config,
      });

      res.status(HTTP_STATUS.CREATED).json(paymentMethod.toPublicObject());
    } catch (error) {
      this.exceptionFilter.catch(error, req, res, nxt);
    }
  }

  /**
   * @openapi
   * /api/v1/payment-methods:
   *   get:
   *     tags: [Payment Methods]
   *     summary: Get all payment methods with pagination
   */
  @Get('/')
  async getAllPaymentMethods(@request() req: Request, @response() res: Response, @next() nxt: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const result = await this.paymentMethodService.findAll(page, limit);
      res.status(HTTP_STATUS.OK).json(result);
    } catch (error) {
      this.exceptionFilter.catch(error, req, res, nxt);
    }
  }

  /**
   * @openapi
   * /api/v1/payment-methods/{id}:
   *   get:
   *     tags: [Payment Methods]
   *     summary: Get a payment method by ID
   */
  @Get('/:id')
  async getPaymentMethodById(@request() req: Request, @response() res: Response, @next() nxt: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const paymentMethod = await this.paymentMethodService.findById(id as any);

      if (!paymentMethod) {
        res.status(HTTP_STATUS.NOT_FOUND).json({ error: ERROR_CODES.NOT_FOUND, message: 'Payment method not found' });
        return;
      }

      res.status(HTTP_STATUS.OK).json(paymentMethod.toPublicObject());
    } catch (error) {
      this.exceptionFilter.catch(error, req, res, nxt);
    }
  }

  /**
   * @openapi
   * /api/v1/payment-methods/type/{type}:
   *   get:
   *     tags: [Payment Methods]
   *     summary: Get payment methods by type (mpesa or pesaflow)
   */
  @Get('/type/:type')
  async getPaymentMethodsByType(@request() req: Request, @response() res: Response, @next() nxt: NextFunction): Promise<void> {
    try {
      const type = req.params.type as string;
      const typeMap: Record<string, any> = { mpesa: 0, pesaflow: 1 };
      const enumType = typeMap[type];

      if (enumType === undefined) {
        res.status(HTTP_STATUS.UNPROCESSABLE_ENTITY).json({ error: ERROR_CODES.VALIDATION_ERROR, message: 'Invalid payment method type' });
        return;
      }

      const methods = await this.paymentMethodService.findByType(enumType);
      res.status(HTTP_STATUS.OK).json({ data: methods.map((m) => m.toPublicObject()) });
    } catch (error) {
      this.exceptionFilter.catch(error, req, res, nxt);
    }
  }

  /**
   * @openapi
   * /api/v1/payment-methods/{id}:
   *   patch:
   *     tags: [Payment Methods]
   *     summary: Update a payment method
   */
  @Patch('/:id')
  async updatePaymentMethod(@request() req: Request, @response() res: Response, @next() nxt: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const body = req.body;
      const paymentMethod = await this.paymentMethodService.updatePaymentMethod(id as any, body);
      res.status(HTTP_STATUS.OK).json(paymentMethod.toPublicObject());
    } catch (error) {
      this.exceptionFilter.catch(error, req, res, nxt);
    }
  }

  /**
   * @openapi
   * /api/v1/payment-methods/{id}/deactivate:
   *   post:
   *     tags: [Payment Methods]
   *     summary: Deactivate a payment method
   */
  @Post('/:id/deactivate')
  async deactivatePaymentMethod(@request() req: Request, @response() res: Response, @next() nxt: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const paymentMethod = await this.paymentMethodService.deactivatePaymentMethod(id as any);
      res.status(HTTP_STATUS.OK).json(paymentMethod.toPublicObject());
    } catch (error) {
      this.exceptionFilter.catch(error, req, res, nxt);
    }
  }

  /**
   * @openapi
   * /api/v1/payment-methods/{id}/activate:
   *   post:
   *     tags: [Payment Methods]
   *     summary: Activate a payment method
   */
  @Post('/:id/activate')
  async activatePaymentMethod(@request() req: Request, @response() res: Response, @next() nxt: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const paymentMethod = await this.paymentMethodService.activatePaymentMethod(id as any);
      res.status(HTTP_STATUS.OK).json(paymentMethod.toPublicObject());
    } catch (error) {
      this.exceptionFilter.catch(error, req, res, nxt);
    }
  }
}
