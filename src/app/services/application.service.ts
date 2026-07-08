import { inject, injectable } from 'inversify';
import { TYPES } from '../../infra/config/inversify.config.js';
import type { IApplicationRepository, ICustomerRepository, IPaymentMethodRepository } from '../../core/interfaces/repository/index.js';
import { ApplicationEntity } from '../../core/domain/application.entity.js';
import type { PaymentMethodConfig, MpesaConfig, PesaFlowConfig } from '../../core/domain/application.entity.js';
import { PaymentMethodTypeEnum } from '../../core/domain/payment-method.entity.js';
import type { UUID } from '../../core/domain/base.entity.js';
import { HTTP_STATUS, ERROR_CODES } from '../../config/constants.js';
import { ApplicationError } from './authentication.service.js';

export interface CreateMpesaApplicationInput {
  customerId: UUID;
  paymentMethodId: UUID;
  name: string;
  description: string;
  consumerKey: string;
  consumerSecret: string;
  passKey: string;
  shortCode: string;
}

export interface CreatePesaFlowApplicationInput {
  customerId: UUID;
  paymentMethodId: UUID;
  name: string;
  description: string;
  apiKey: string;
  apiSecret: string;
  apiClientId: string;
}

@injectable()
export class ApplicationService {
  constructor(
    @inject(TYPES.ApplicationRepository) private applicationRepository: IApplicationRepository,
    @inject(TYPES.CustomerRepository) private customerRepository: ICustomerRepository,
    @inject(TYPES.PaymentMethodRepository) private paymentMethodRepository: IPaymentMethodRepository,
  ) {}

  async createMpesaApplication(input: CreateMpesaApplicationInput): Promise<ApplicationEntity> {
    const paymentMethod = await this.paymentMethodRepository.findById(input.paymentMethodId);
    if (!paymentMethod) {
      throw new ApplicationError('Payment method not found', ERROR_CODES.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
    }

    if (paymentMethod.type !== PaymentMethodTypeEnum.MPESA) {
      throw new ApplicationError('Invalid payment method type for M-PESA application', ERROR_CODES.VALIDATION_ERROR, HTTP_STATUS.UNPROCESSABLE_ENTITY);
    }

    const config: MpesaConfig = {
      consumerKey: input.consumerKey,
      consumerSecret: input.consumerSecret,
      passKey: input.passKey,
      shortCode: input.shortCode,
    };

    const application = ApplicationEntity.create({
      customerId: input.customerId,
      paymentMethodId: input.paymentMethodId,
      name: input.name,
      description: input.description,
      config,
    });

    return this.applicationRepository.create(application);
  }

  async createPesaFlowApplication(input: CreatePesaFlowApplicationInput): Promise<ApplicationEntity> {
    const paymentMethod = await this.paymentMethodRepository.findById(input.paymentMethodId);
    if (!paymentMethod) {
      throw new ApplicationError('Payment method not found', ERROR_CODES.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
    }

    if (paymentMethod.type !== PaymentMethodTypeEnum.PESAFLOW) {
      throw new ApplicationError('Invalid payment method type for PesaFlow application', ERROR_CODES.VALIDATION_ERROR, HTTP_STATUS.UNPROCESSABLE_ENTITY);
    }

    const config: PesaFlowConfig = {
      apiKey: input.apiKey,
      apiSecret: input.apiSecret,
      apiClientId: input.apiClientId,
    };

    const application = ApplicationEntity.create({
      customerId: input.customerId,
      paymentMethodId: input.paymentMethodId,
      name: input.name,
      description: input.description,
      config,
    });

    return this.applicationRepository.create(application);
  }

  async findById(id: UUID): Promise<ApplicationEntity | null> {
    return this.applicationRepository.findById(id);
  }

  async findByCustomerId(customerId: UUID, page = 1, limit = 20) {
    return this.applicationRepository.findByCustomerId(customerId, { page, limit });
  }

  async updateApplication(id: UUID, name?: string, description?: string): Promise<ApplicationEntity> {
    const application = await this.applicationRepository.findById(id);
    if (!application) {
      throw new ApplicationError('Application not found', ERROR_CODES.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
    }

    if (name) application.updateName(name);
    if (description) application.updateDescription(description);

    return this.applicationRepository.update(application);
  }

  async activateApplication(id: UUID): Promise<ApplicationEntity> {
    const application = await this.applicationRepository.findById(id);
    if (!application) {
      throw new ApplicationError('Application not found', ERROR_CODES.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
    }
    application.activate();
    return this.applicationRepository.update(application);
  }

  async deactivateApplication(id: UUID): Promise<ApplicationEntity> {
    const application = await this.applicationRepository.findById(id);
    if (!application) {
      throw new ApplicationError('Application not found', ERROR_CODES.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
    }
    application.deactivate();
    return this.applicationRepository.update(application);
  }
}