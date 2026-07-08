import { injectable } from 'inversify';
import { ERROR_CODES, HTTP_STATUS } from '../../config/constants.js';
import { ApplicationError } from '../../app/services/authentication.service.js';

export interface PipeResult<T = any> {
  value: T;
  error?: string;
}

@injectable()
export class validationPipe {
  async transform<T>(value: any, schema: Record<string, any>): Promise<PipeResult<T>> {
    const errors: string[] = [];

    for (const [key, rules] of Object.entries(schema)) {
      if (rules.required && (value[key] === undefined || value[key] === null || value[key] === '')) {
        errors.push(`${key} is required`);
        continue;
      }

      if (value[key] === undefined || value[key] === null) continue;

      if (rules.type === 'string' && typeof value[key] !== 'string') {
        errors.push(`${key} must be a string`);
      }

      if (rules.type === 'number' && (typeof value[key] !== 'number' || isNaN(value[key]))) {
        errors.push(`${key} must be a number`);
      }

      if (rules.type === 'boolean' && typeof value[key] !== 'boolean') {
        errors.push(`${key} must be a boolean`);
      }

      if (rules.minLength && typeof value[key] === 'string' && value[key].length < rules.minLength) {
        errors.push(`${key} must be at least ${rules.minLength} characters`);
      }

      if (rules.maxLength && typeof value[key] === 'string' && value[key].length > rules.maxLength) {
        errors.push(`${key} must be at most ${rules.maxLength} characters`);
      }

      if (rules.min !== undefined && typeof value[key] === 'number' && value[key] < rules.min) {
        errors.push(`${key} must be at least ${rules.min}`);
      }

      if (rules.max !== undefined && typeof value[key] === 'number' && value[key] > rules.max) {
        errors.push(`${key} must be at most ${rules.max}`);
      }

      if (rules.enum && !rules.enum.includes(value[key])) {
        errors.push(`${key} must be one of: ${rules.enum.join(', ')}`);
      }

      if (rules.pattern && typeof value[key] === 'string' && !rules.pattern.test(value[key])) {
        errors.push(`${key} format is invalid`);
      }
    }

    if (errors.length > 0) {
      return { value, error: errors.join('; ') };
    }

    return { value };
  }

  validateUuid(value: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(value);
  }

  validateEmail(value: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  }

  validateApiKey(value: string): boolean {
    return value.startsWith('crz_');
  }
}

@injectable()
export class transformPipe {
  toNumber(value: any): number {
    const num = Number(value);
    if (isNaN(num)) throw new ApplicationError('Invalid number', ERROR_CODES.VALIDATION_ERROR, HTTP_STATUS.UNPROCESSABLE_ENTITY);
    return num;
  }

  toBoolean(value: any): boolean {
    if (typeof value === 'boolean') return value;
    if (value === 'true' || value === '1') return true;
    if (value === 'false' || value === '0') return false;
    throw new ApplicationError('Invalid boolean', ERROR_CODES.VALIDATION_ERROR, HTTP_STATUS.UNPROCESSABLE_ENTITY);
  }

  trimString(value: any): string {
    if (typeof value !== 'string') return '';
    return value.trim();
  }

  toLowerCase(value: any): string {
    if (typeof value !== 'string') return '';
    return value.toLowerCase().trim();
  }

  sanitizeObject(obj: Record<string, any>, allowedFields: string[]): Record<string, any> {
    const sanitized: Record<string, any> = {};
    for (const field of allowedFields) {
      if (obj[field] !== undefined) {
        sanitized[field] = obj[field];
      }
    }
    return sanitized;
  }
}