import { inject } from 'inversify';
import { Controller, Get, Post, Request as _Request, Response as _Response, Next as _Next } from '@inversifyjs/http-core';
import type { Request, Response, NextFunction } from 'express';
import { TYPES } from '../../infra/config/inversify.config.js';
import { AuthenticationService } from '../../app/services/authentication.service.js';
import { validationPipe } from '../pipes/index.js';
import { exceptionFilter } from '../filters/index.js';
import { HTTP_STATUS } from '../../config/constants.js';
import { getConfig } from '../../config/env.js';

@Controller('/api/v1/auth')
export class AuthenticationController {
  constructor(
    @inject(TYPES.AuthenticationService) private authService: AuthenticationService,
    @inject(TYPES.ValidationPipe) private validate: validationPipe,
    @inject(TYPES.ExceptionFilter) private exceptionFilter: exceptionFilter,
  ) {}

  /**
   * @openapi
   * /api/v1/auth/token:
   *   post:
   *     tags: [Authentication]
   *     summary: Generate JWT token pair
   *     description: Authenticates using Basic Auth and returns access + refresh tokens
   *     security:
   *       - basicAuth: []
   *     parameters:
   *       - in: query
   *         name: evict_token
   *         schema:
   *           type: string
   *         description: Set to 'true' to evict existing tokens
   *     responses:
   *       200:
   *         description: Token generated successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/TokenResponse'
   *       401:
   *         description: Authentication failed
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  @Post('/token')
  async generateToken(@_Request() req: Request, @_Response() res: Response, @_Next() nxt: NextFunction): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        res.status(401).json({ error: 'Missing authorization header', message: 'Basic authentication required' });
        return;
      }

      const parts = authHeader.split(' ');
      if (parts.length !== 2 || parts[0] !== 'Basic') {
        res.status(401).json({ error: 'Invalid authorization header', message: 'Use Basic authentication format' });
        return;
      }

      const credentials = Buffer.from(parts[1], 'base64').toString('utf-8');
      const [clientId, clientSecret] = credentials.split(':');

      if (!clientId || !clientSecret) {
        res.status(401).json({ error: 'Invalid credentials', message: 'Client ID and secret required' });
        return;
      }

      const evictToken = req.query.evict_token === 'true';

      const result = await this.authService.authenticateWithBasicAuth(clientId, clientSecret, evictToken);

      res.status(HTTP_STATUS.OK).json({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresIn: result.expiresIn,
        tokenType: result.tokenType,
      });
    } catch (error) {
      this.exceptionFilter.catch(error, req, res, nxt);
    }
  }

  /**
   * @openapi
   * /api/v1/auth/refresh:
   *   post:
   *     tags: [Authentication]
   *     summary: Refresh JWT access token
   *     description: Exchanges a valid refresh token for a new access token pair
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - refreshToken
   *             properties:
   *               refreshToken:
   *                 type: string
   *     responses:
   *       200:
   *         description: Token refreshed successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/TokenResponse'
   *       400:
   *         description: Refresh token required
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  @Post('/refresh')
  async refreshToken(@_Request() req: Request, @_Response() res: Response, @_Next() nxt: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) {
        res.status(400).json({ error: 'Refresh token required', message: 'Refresh token is required' });
        return;
      }

      const result = await this.authService.refreshAccessToken(refreshToken);

      res.status(HTTP_STATUS.OK).json({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresIn: result.expiresIn,
        tokenType: result.tokenType,
      });
    } catch (error) {
      this.exceptionFilter.catch(error, req, res, nxt);
    }
  }

  /**
   * @openapi
   * /api/v1/auth/revoke:
   *   post:
   *     tags: [Authentication]
   *     summary: Revoke JWT token
   *     description: Revokes the Bearer token from the Authorization header
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Token revoked successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: Token revoked successfully
   */
  @Post('/revoke')
  async revokeToken(@_Request() req: Request, @_Response() res: Response, @_Next() nxt: NextFunction): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      if (authHeader) {
        const token = authHeader.split(' ')[1];
        if (token) {
          await this.authService.revokeToken(token);
        }
      }

      res.status(HTTP_STATUS.OK).json({ message: 'Token revoked successfully' });
    } catch (error) {
      this.exceptionFilter.catch(error, req, res, nxt);
    }
  }

  /**
   * @openapi
   * /api/v1/auth/status:
   *   get:
   *     tags: [Authentication]
   *     summary: Check JWT token status
   *     description: Validates the Bearer token and returns authentication status with user details
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Token status result
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 authenticated:
   *                   type: boolean
   *                 userId:
   *                   type: string
   *                   format: uuid
   *                 customerId:
   *                   type: string
   *                   format: uuid
   *                 clientId:
   *                   type: string
   */
  @Get('/status')
  async getTokenStatus(@_Request() req: Request, @_Response() res: Response, @_Next() nxt: NextFunction): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        res.status(200).json({ authenticated: false });
        return;
      }

      const token = authHeader.split(' ')[1];
      if (!token) {
        res.status(200).json({ authenticated: false });
        return;
      }

      const validation = await this.authService.validateAccessToken(token);
      res.status(HTTP_STATUS.OK).json({
        authenticated: validation.isValid,
        userId: validation.userId,
        customerId: validation.customerId,
        clientId: validation.clientId,
      });
    } catch (error) {
      this.exceptionFilter.catch(error, req, res, nxt);
    }
  }
}
