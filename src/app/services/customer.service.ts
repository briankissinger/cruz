import { inject, injectable } from 'inversify';
import { TYPES } from '../../infra/config/inversify.config.js';
import type { ICustomerRepository, IUserRepository, IApplicationRepository } from '../../core/interfaces/repository/index.js';
import { CustomerEntity } from '../../core/domain/customer.entity.js';
import type { UUID } from '../../core/domain/base.entity.js';
import { HTTP_STATUS, ERROR_CODES } from '../../config/constants.js';
import { ApplicationError } from './authentication.service.js';
import { ApiKeyService } from './api-key.service.js';

export interface CreateCustomerInput {
  userId: UUID;
  name: string;
}

@injectable()
export class CustomerService {
  constructor(
    @inject(TYPES.CustomerRepository) private customerRepository: ICustomerRepository,
    @inject(TYPES.UserRepository) private userRepository: IUserRepository,
    @inject(TYPES.ApiKeyService) private apiKeyService: ApiKeyService,
  ) {}

  async createCustomer(input: CreateCustomerInput): Promise<CustomerEntity> {
    const user = await this.userRepository.findById(input.userId);
    if (!user) {
      throw new ApplicationError('User not found', ERROR_CODES.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
    }

    const clientId = this.apiKeyService.generateClientId();
    const clientSecret = this.apiKeyService.generateClientSecret();
    const apiKey = this.apiKeyService.generateApiKey();

    const customer = CustomerEntity.create({
      userId: input.userId,
      clientId,
      clientSecret,
      apiKey,
      name: input.name,
    });

    return this.customerRepository.create(customer);
  }

  async findById(id: UUID): Promise<CustomerEntity | null> {
    return this.customerRepository.findById(id);
  }

  async findByUserId(userId: UUID): Promise<CustomerEntity | null> {
    return this.customerRepository.findByUserId(userId);
  }

  async findByClientId(clientId: string): Promise<CustomerEntity | null> {
    return this.customerRepository.findByClientId(clientId);
  }

  async findByApiKey(apiKey: string): Promise<CustomerEntity | null> {
    return this.customerRepository.findByApiKey(apiKey);
  }

  async updateCustomerName(id: UUID, name: string): Promise<CustomerEntity> {
    const customer = await this.customerRepository.findById(id);
    if (!customer) {
      throw new ApplicationError('Customer not found', ERROR_CODES.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
    }
    customer.updateName(name);
    return this.customerRepository.update(customer);
  }

  async rotateApiKey(id: UUID): Promise<CustomerEntity> {
    const customer = await this.customerRepository.findById(id);
    if (!customer) {
      throw new ApplicationError('Customer not found', ERROR_CODES.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
    }
    const newApiKey = this.apiKeyService.generateApiKey();
    customer.rotateApiKey(newApiKey);
    return this.customerRepository.update(customer);
  }

  async rotateClientSecret(id: UUID): Promise<CustomerEntity> {
    const customer = await this.customerRepository.findById(id);
    if (!customer) {
      throw new ApplicationError('Customer not found', ERROR_CODES.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
    }
    const newClientSecret = this.apiKeyService.generateClientSecret();
    customer.rotateClientSecret(newClientSecret);
    return this.customerRepository.update(customer);
  }
}