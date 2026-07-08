import { inject } from 'inversify';
import type { Request } from 'express';
import { Controller, Get, Post, Patch, Request as request, Response as response, Next as next } from '@inversifyjs/http-core';
import { TYPES } from '../../infra/config/inversify.config.js';
import { CustomerService } from '../../app/services/customer.service.js';
import { validationPipe } from '../pipes/index.js';
import { exceptionFilter } from '../filters/index.js';
import { HTTP_STATUS, ERROR_CODES } from '../../config/constants.js';

@Controller('/api/v1/customers')
export class CustomerController {
  constructor(
    @inject(TYPES.CustomerService) private customerService: CustomerService,
    @inject(TYPES.ValidationPipe) private validate: validationPipe,
    @inject(TYPES.ExceptionFilter) private exceptionFilter: exceptionFilter,
  ) {}

  /**
   * @openapi
   * /api/v1/customers:
   *   post:
   *     tags: [Customers]
   *     summary: Create a new customer
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               userId:
   *                 type: string
   *               name:
   *                 type: string
   *     responses:
   *       201:
   *         description: Customer created successfully
   *       422:
   *         description: Validation error
   */
  @Post('/')
  async createCustomer(@request() req: Request, @response() res: any, @next() nxt: any): Promise<void> {
    try {
      const body = req.body;
      const validation = await this.validate.transform(body, {
        userId: { required: true, type: 'string', minLength: 36 },
        name: { required: true, type: 'string', minLength: 1, maxLength: 255 },
      });

      if (validation.error) {
        res.status(HTTP_STATUS.UNPROCESSABLE_ENTITY).json({ error: ERROR_CODES.VALIDATION_ERROR, message: validation.error });
        return;
      }

      const customer = await this.customerService.createCustomer({
        userId: body.userId,
        name: body.name,
      });

      res.status(HTTP_STATUS.CREATED).json(customer.toPublicObject());
    } catch (error) {
      this.exceptionFilter.catch(error, req, res, nxt);
    }
  }

  /**
   * @openapi
   * /api/v1/customers/me:
   *   get:
   *     tags: [Customers]
   *     summary: Get current authenticated customer
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Customer data
   *       401:
   *         description: Not authenticated
   */
  @Get('/me')
  async getCurrentCustomer(@request() req: Request, @response() res: any, @next() nxt: any): Promise<void> {
    try {
      const customerId = (req as any).user?.customerId;
      if (!customerId) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json({ error: ERROR_CODES.AUTHENTICATION_FAILED, message: 'Not authenticated' });
        return;
      }

      const customer = await this.customerService.findById(customerId);
      if (!customer) {
        res.status(HTTP_STATUS.NOT_FOUND).json({ error: ERROR_CODES.NOT_FOUND, message: 'Customer not found' });
        return;
      }

      res.status(HTTP_STATUS.OK).json(customer.toPublicObject());
    } catch (error) {
      this.exceptionFilter.catch(error, req, res, nxt);
    }
  }

  /**
   * @openapi
   * /api/v1/customers/{id}:
   *   get:
   *     tags: [Customers]
   *     summary: Get customer by ID
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Customer data
   *       404:
   *         description: Customer not found
   */
  @Get('/:id')
  async getCustomerById(@request() req: Request, @response() res: any, @next() nxt: any): Promise<void> {
    try {
      const { id } = req.params;
      const customer = await this.customerService.findById(id as any);

      if (!customer) {
        res.status(HTTP_STATUS.NOT_FOUND).json({ error: ERROR_CODES.NOT_FOUND, message: 'Customer not found' });
        return;
      }

      res.status(HTTP_STATUS.OK).json(customer.toPublicObject());
    } catch (error) {
      this.exceptionFilter.catch(error, req, res, nxt);
    }
  }

  /**
   * @openapi
   * /api/v1/customers/{id}:
   *   patch:
   *     tags: [Customers]
   *     summary: Update customer name
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               name:
   *                 type: string
   *     responses:
   *       200:
   *         description: Customer updated
   *       422:
   *         description: Validation error
   */
  @Patch('/:id')
  async updateCustomerName(@request() req: Request, @response() res: any, @next() nxt: any): Promise<void> {
    try {
      const { id } = req.params;
      const { name } = req.body;

      if (!name) {
        res.status(HTTP_STATUS.UNPROCESSABLE_ENTITY).json({ error: ERROR_CODES.VALIDATION_ERROR, message: 'Name is required' });
        return;
      }

      const customer = await this.customerService.updateCustomerName(id as any, name);
      res.status(HTTP_STATUS.OK).json(customer.toPublicObject());
    } catch (error) {
      this.exceptionFilter.catch(error, req, res, nxt);
    }
  }

  /**
   * @openapi
   * /api/v1/customers/{id}/rotate-api-key:
   *   post:
   *     tags: [Customers]
   *     summary: Rotate customer API key
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: API key rotated
   */
  @Post('/:id/rotate-api-key')
  async rotateApiKey(@request() req: Request, @response() res: any, @next() nxt: any): Promise<void> {
    try {
      const { id } = req.params;
      const customer = await this.customerService.rotateApiKey(id as any);
      res.status(HTTP_STATUS.OK).json({ apiKey: customer.apiKey });
    } catch (error) {
      this.exceptionFilter.catch(error, req, res, nxt);
    }
  }

  /**
   * @openapi
   * /api/v1/customers/{id}/rotate-secret:
   *   post:
   *     tags: [Customers]
   *     summary: Rotate customer client secret
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Client secret rotated
   */
  @Post('/:id/rotate-secret')
  async rotateClientSecret(@request() req: Request, @response() res: any, @next() nxt: any): Promise<void> {
    try {
      const { id } = req.params;
      const customer = await this.customerService.rotateClientSecret(id as any);
      res.status(HTTP_STATUS.OK).json({ clientId: customer.clientId });
    } catch (error) {
      this.exceptionFilter.catch(error, req, res, nxt);
    }
  }
}
