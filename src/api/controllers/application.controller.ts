import { inject } from 'inversify';
import type { Request } from 'express';
import { Controller, Get, Post, Patch, Delete, Request as _Request, Response, Next } from '@inversifyjs/http-core';
import { TYPES } from '../../infra/config/inversify.config.js';
import { ApplicationService } from '../../app/services/application.service.js';
import { validationPipe } from '../pipes/index.js';
import { exceptionFilter } from '../filters/index.js';
import { HTTP_STATUS, ERROR_CODES } from '../../config/constants.js';

@Controller('/api/v1/applications')
export class ApplicationController {
  constructor(
    @inject(TYPES.ApplicationService) private applicationService: ApplicationService,
    @inject(TYPES.ValidationPipe) private validate: validationPipe,
    @inject(TYPES.ExceptionFilter) private exceptionFilter: exceptionFilter,
  ) {}

  /**
   * @openapi
   * /api/v1/applications/mpesa:
   *   post:
   *     tags: [Applications]
   *     summary: Create a new M-Pesa application
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               paymentMethodId:
   *                 type: string
   *               name:
   *                 type: string
   *               consumerKey:
   *                 type: string
   *               consumerSecret:
   *                 type: string
   *               passKey:
   *                 type: string
   *               shortCode:
   *                 type: string
   *     responses:
   *       201:
   *         description: Application created
   *       422:
   *         description: Validation error
   */
  @Post('/mpesa')
  async createMpesaApplication(@_Request() req: Request, @Response() res: any, @Next() nxt: any): Promise<void> {
    try {
      const customerId = (req as any).user?.customerId;
      const body = req.body;
      const validation = await this.validate.transform(body, {
        paymentMethodId: { required: true, type: 'string', minLength: 36 },
        name: { required: true, type: 'string', minLength: 1 },
        consumerKey: { required: true, type: 'string' },
        consumerSecret: { required: true, type: 'string' },
        passKey: { required: true, type: 'string' },
        shortCode: { required: true, type: 'string' },
      });

      if (validation.error) {
        res.status(HTTP_STATUS.UNPROCESSABLE_ENTITY).json({ error: ERROR_CODES.VALIDATION_ERROR, message: validation.error });
        return;
      }

      const application = await this.applicationService.createMpesaApplication({
        customerId,
        paymentMethodId: body.paymentMethodId,
        name: body.name,
        description: body.description || '',
        consumerKey: body.consumerKey,
        consumerSecret: body.consumerSecret,
        passKey: body.passKey,
        shortCode: body.shortCode,
      });

      res.status(HTTP_STATUS.CREATED).json(application.toPublicObject());
    } catch (error) {
      this.exceptionFilter.catch(error, req, res, nxt);
    }
  }

  /**
   * @openapi
   * /api/v1/applications/pesaflow:
   *   post:
   *     tags: [Applications]
   *     summary: Create a new PesaFlow application
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               paymentMethodId:
   *                 type: string
   *               name:
   *                 type: string
   *               apiKey:
   *                 type: string
   *               apiSecret:
   *                 type: string
   *               apiClientId:
   *                 type: string
   *     responses:
   *       201:
   *         description: Application created
   *       422:
   *         description: Validation error
   */
  @Post('/pesaflow')
  async createPesaFlowApplication(@_Request() req: Request, @Response() res: any, @Next() nxt: any): Promise<void> {
    try {
      const customerId = (req as any).user?.customerId;
      const body = req.body;
      const validation = await this.validate.transform(body, {
        paymentMethodId: { required: true, type: 'string', minLength: 36 },
        name: { required: true, type: 'string', minLength: 1 },
        apiKey: { required: true, type: 'string' },
        apiSecret: { required: true, type: 'string' },
        apiClientId: { required: true, type: 'string' },
      });

      if (validation.error) {
        res.status(HTTP_STATUS.UNPROCESSABLE_ENTITY).json({ error: ERROR_CODES.VALIDATION_ERROR, message: validation.error });
        return;
      }

      const application = await this.applicationService.createPesaFlowApplication({
        customerId,
        paymentMethodId: body.paymentMethodId,
        name: body.name,
        description: body.description || '',
        apiKey: body.apiKey,
        apiSecret: body.apiSecret,
        apiClientId: body.apiClientId,
      });

      res.status(HTTP_STATUS.CREATED).json(application.toPublicObject());
    } catch (error) {
      this.exceptionFilter.catch(error, req, res, nxt);
    }
  }

  /**
   * @openapi
   * /api/v1/applications:
   *   get:
   *     tags: [Applications]
   *     summary: Get all applications for the authenticated customer
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: List of applications
   */
  @Get('/')
  async getCustomerApplications(@_Request() req: Request, @Response() res: any, @Next() nxt: any): Promise<void> {
    try {
      const customerId = (req as any).user?.customerId;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await this.applicationService.findByCustomerId(customerId, page, limit);
      res.status(HTTP_STATUS.OK).json(result);
    } catch (error) {
      this.exceptionFilter.catch(error, req, res, nxt);
    }
  }

  /**
   * @openapi
   * /api/v1/applications/{id}:
   *   get:
   *     tags: [Applications]
   *     summary: Get application by ID
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Application data
   *       404:
   *         description: Application not found
   */
  @Get('/:id')
  async getApplicationById(@_Request() req: Request, @Response() res: any, @Next() nxt: any): Promise<void> {
    try {
      const { id } = req.params;
      const application = await this.applicationService.findById(id as any);

      if (!application) {
        res.status(HTTP_STATUS.NOT_FOUND).json({ error: ERROR_CODES.NOT_FOUND, message: 'Application not found' });
        return;
      }

      res.status(HTTP_STATUS.OK).json(application.toPublicObject());
    } catch (error) {
      this.exceptionFilter.catch(error, req, res, nxt);
    }
  }

  /**
   * @openapi
   * /api/v1/applications/{id}:
   *   patch:
   *     tags: [Applications]
   *     summary: Update application name and description
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
   *               description:
   *                 type: string
   *     responses:
   *       200:
   *         description: Application updated
   */
  @Patch('/:id')
  async updateApplication(@_Request() req: Request, @Response() res: any, @Next() nxt: any): Promise<void> {
    try {
      const { id } = req.params;
      const { name, description } = req.body;
      const application = await this.applicationService.updateApplication(id as any, name, description);
      res.status(HTTP_STATUS.OK).json(application.toPublicObject());
    } catch (error) {
      this.exceptionFilter.catch(error, req, res, nxt);
    }
  }

  /**
   * @openapi
   * /api/v1/applications/{id}/activate:
   *   post:
   *     tags: [Applications]
   *     summary: Activate an application
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Application activated
   */
  @Post('/:id/activate')
  async activateApplication(@_Request() req: Request, @Response() res: any, @Next() nxt: any): Promise<void> {
    try {
      const { id } = req.params;
      const application = await this.applicationService.activateApplication(id as any);
      res.status(HTTP_STATUS.OK).json(application.toPublicObject());
    } catch (error) {
      this.exceptionFilter.catch(error, req, res, nxt);
    }
  }

  /**
   * @openapi
   * /api/v1/applications/{id}/deactivate:
   *   post:
   *     tags: [Applications]
   *     summary: Deactivate an application
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Application deactivated
   */
  @Post('/:id/deactivate')
  async deactivateApplication(@_Request() req: Request, @Response() res: any, @Next() nxt: any): Promise<void> {
    try {
      const { id } = req.params;
      const application = await this.applicationService.deactivateApplication(id as any);
      res.status(HTTP_STATUS.OK).json(application.toPublicObject());
    } catch (error) {
      this.exceptionFilter.catch(error, req, res, nxt);
    }
  }
}
