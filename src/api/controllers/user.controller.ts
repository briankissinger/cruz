import { inject, injectable } from 'inversify';
import { Controller, Get, Patch, Post, Request as request, Response as response, Next as next } from '@inversifyjs/http-core';
import type { Request, Response, NextFunction } from 'express';
import { TYPES } from '../../infra/config/inversify.config.js';
import { UserService } from '../../app/services/user.service.js';
import { validationPipe } from '../pipes/index.js';
import { exceptionFilter } from '../filters/index.js';
import { HTTP_STATUS, ERROR_CODES } from '../../config/constants.js';

@Controller('/api/v1/users')
export class UserController {
  constructor(
    @inject(TYPES.UserService) private userService: UserService,
    @inject(TYPES.ValidationPipe) private validate: validationPipe,
    @inject(TYPES.ExceptionFilter) private exceptionFilter: exceptionFilter,
  ) {}

  /**
   * @openapi
   * /api/v1/users:
   *   post:
   *     tags: [Users]
   *     summary: Create a new user
   *     description: Creates a user with name, email, and password
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateUserInput'
   *     responses:
   *       201:
   *         description: User created successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/User'
   *       422:
   *         description: Validation error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  @Post('/')
  async createUser(@request() req: Request, @response() res: Response, @next() nxt: NextFunction): Promise<void> {
    try {
      const body = req.body;
      const validation = await this.validate.transform(body, {
        name: { required: true, type: 'string', minLength: 1, maxLength: 255 },
        email: { required: true, type: 'string', minLength: 5 },
        password: { required: true, type: 'string', minLength: 8 },
      });

      if (validation.error) {
        res.status(HTTP_STATUS.UNPROCESSABLE_ENTITY).json({ error: ERROR_CODES.VALIDATION_ERROR, message: validation.error });
        return;
      }

      if (!this.validate.validateEmail(body.email)) {
        res.status(HTTP_STATUS.UNPROCESSABLE_ENTITY).json({ error: ERROR_CODES.VALIDATION_ERROR, message: 'Invalid email format' });
        return;
      }

      const user = await this.userService.createUser({
        name: body.name,
        email: body.email,
        password: body.password,
      });

      res.status(HTTP_STATUS.CREATED).json(user.toPublicObject());
    } catch (error) {
      this.exceptionFilter.catch(error, req, res, nxt);
    }
  }

  /**
   * @openapi
   * /api/v1/users/{id}:
   *   get:
   *     tags: [Users]
   *     summary: Get user by ID
   *     description: Retrieves a user's public profile by UUID
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: User UUID
   *     responses:
   *       200:
   *         description: User found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/User'
   *       404:
   *         description: User not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  @Get('/:id')
  async getUserById(@request() req: Request, @response() res: Response, @next() nxt: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const user = await this.userService.findById(id as any);

      if (!user) {
        res.status(HTTP_STATUS.NOT_FOUND).json({ error: ERROR_CODES.NOT_FOUND, message: 'User not found' });
        return;
      }

      res.status(HTTP_STATUS.OK).json(user.toPublicObject());
    } catch (error) {
      this.exceptionFilter.catch(error, req, res, nxt);
    }
  }

  /**
   * @openapi
   * /api/v1/users/{id}:
   *   patch:
   *     tags: [Users]
   *     summary: Update user
   *     description: Updates a user's name and/or email
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: User UUID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               name:
   *                 type: string
   *               email:
   *                 type: string
   *                 format: email
   *     responses:
   *       200:
   *         description: User updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/User'
   *       422:
   *         description: Validation error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  @Patch('/:id')
  async updateUser(@request() req: Request, @response() res: Response, @next() nxt: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const body = req.body;

      const validation = await this.validate.transform(body, {
        name: { type: 'string', minLength: 1 },
        email: { type: 'string' },
      });

      if (validation.error) {
        res.status(HTTP_STATUS.UNPROCESSABLE_ENTITY).json({ error: ERROR_CODES.VALIDATION_ERROR, message: validation.error });
        return;
      }

      const user = await this.userService.updateUser(id as any, {
        name: body.name,
        email: body.email,
      });

      res.status(HTTP_STATUS.OK).json(user.toPublicObject());
    } catch (error) {
      this.exceptionFilter.catch(error, req, res, nxt);
    }
  }

  /**
   * @openapi
   * /api/v1/users/{id}/deactivate:
   *   post:
   *     tags: [Users]
   *     summary: Deactivate user
   *     description: Sets a user's status to inactive
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: User UUID
   *     responses:
   *       200:
   *         description: User deactivated successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/User'
   */
  @Post('/:id/deactivate')
  async deactivateUser(@request() req: Request, @response() res: Response, @next() nxt: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const user = await this.userService.deactivateUser(id as any);
      res.status(HTTP_STATUS.OK).json(user.toPublicObject());
    } catch (error) {
      this.exceptionFilter.catch(error, req, res, nxt);
    }
  }

  /**
   * @openapi
   * /api/v1/users/{id}/activate:
   *   post:
   *     tags: [Users]
   *     summary: Activate user
   *     description: Sets a user's status to active
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: User UUID
   *     responses:
   *       200:
   *         description: User activated successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/User'
   */
  @Post('/:id/activate')
  async activateUser(@request() req: Request, @response() res: Response, @next() nxt: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const user = await this.userService.activateUser(id as any);
      res.status(HTTP_STATUS.OK).json(user.toPublicObject());
    } catch (error) {
      this.exceptionFilter.catch(error, req, res, nxt);
    }
  }
}
