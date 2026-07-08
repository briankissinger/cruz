import { inject, injectable } from 'inversify';
import { TYPES } from '../../infra/config/inversify.config.js';
import type { ICustomerRepository } from '../../core/interfaces/repository/index.js';
import { CustomerEntity } from '../../core/domain/customer.entity.js';

export interface ApiKeyValidationResult {
  isValid: boolean;
  customer?: CustomerEntity;
  error?: string;
  isBlacklisted?: boolean;
}

@injectable()
export class ApiKeyService {
  constructor(
    @inject(TYPES.CustomerRepository) private customerRepository: ICustomerRepository,
  ) {}

  async validateApiKey(apiKey: string | undefined): Promise<ApiKeyValidationResult> {
    if (!apiKey) {
      return { isValid: false, error: 'API key is required' };
    }

    const customer = await this.customerRepository.findByApiKey(apiKey);
    if (!customer) {
      return { isValid: false, error: 'Invalid API key' };
    }

    return { isValid: true, customer };
  }

  async getCustomerByApiKey(apiKey: string): Promise<CustomerEntity | null> {
    return this.customerRepository.findByApiKey(apiKey);
  }

  async rotateApiKey(customerId: string): Promise<string> {
    const customer = await this.customerRepository.findById(customerId as any);
    if (!customer) {
      throw new Error('Customer not found');
    }

    const newApiKey = this.generateApiKey();
    customer.rotateApiKey(newApiKey);
    await this.customerRepository.update(customer);

    return newApiKey;
  }

  generateApiKey(): string {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const key = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return `crz_${key}`;
  }

  generateClientId(): string {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  generateClientSecret(): string {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
}