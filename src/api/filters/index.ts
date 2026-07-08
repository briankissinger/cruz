import { injectable } from 'inversify';
import type { Request, Response, NextFunction } from 'express';
import { ERROR_CODES, HTTP_STATUS } from '../../config/constants.js';
import { ApplicationError } from '../../app/services/authentication.service.js';

export interface ExceptionResponse {
  statusCode: number;
  error: string;
  message: string;
  details?: any;
  timestamp: string;
  path?: string;
  requestId?: string;
}

@injectable()
export class exceptionFilter {
  catch(error: any, request: Request, response: Response, next: NextFunction): void {
    if (error instanceof ApplicationError) {
      const body: ExceptionResponse = {
        statusCode: error.statusCode,
        error: error.errorCode,
        message: error.message,
        timestamp: new Date().toISOString(),
        path: request.path,
        requestId: (request as any).requestId,
      };
      response.status(error.statusCode).json(body);
      return;
    }

    if (error.name === 'SyntaxError' && error.status === 400) {
      const body: ExceptionResponse = {
        statusCode: HTTP_STATUS.BAD_REQUEST,
        error: ERROR_CODES.VALIDATION_ERROR,
        message: 'Invalid JSON in request body',
        timestamp: new Date().toISOString(),
        path: request.path,
        requestId: (request as any).requestId,
      };
      response.status(HTTP_STATUS.BAD_REQUEST).json(body);
      return;
    }

    const body: ExceptionResponse = {
      statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      error: ERROR_CODES.INTERNAL_ERROR,
      message: 'An unexpected error occurred',
      timestamp: new Date().toISOString(),
      path: request.path,
      requestId: (request as any).requestId,
    };
    response.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(body);
  }
}

@injectable()
export class httpExceptionFilter {
  constructor() {}

  catch(error: any, request: Request, response: Response): void {
    const statusCode = error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR;
    const errorCode = error.errorCode || ERROR_CODES.INTERNAL_ERROR;
    const message = error.message || 'An unexpected error occurred';

    const body: ExceptionResponse = {
      statusCode,
      error: errorCode,
      message,
      timestamp: new Date().toISOString(),
      path: request.path,
      requestId: (request as any).requestId,
    };

    if (error.details) {
      body.details = error.details;
    }

    response.status(statusCode).json(body);
  }
}