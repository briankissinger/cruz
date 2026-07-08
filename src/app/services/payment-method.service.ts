import { inject, injectable } from 'inversify';
import { TYPES } from '../../infra/config/inversify.config.js';
import type { IPaymentMethodRepository } from '../../core/interfaces/repository/index.js';
import { PaymentMethodEntity, PaymentMethodTypeEnum } from '../../core/domain/payment-method.entity.js';
import type { PaymentMethodConfig, MpesaConfig, PesaFlowConfig } from '../../core/domain/payment-method.entity.js';
import type { UUID } from '../../core/domain/base.entity.js';
import { HTTP_STATUS, ERROR_CODES } from '../../config/constants.js';
import { ApplicationError } from './authentication.service.js';

export interface CreatePaymentMethodInput {
  name: string;
  description: string;
  type: PaymentMethodTypeEnum;
  testBaseUrl: string;
  productionBaseUrl: string;
  config: PaymentMethodConfig;
}

@injectable()
export class PaymentMethodService {
  constructor(
    @inject(TYPES.PaymentMethodRepository) private paymentMethodRepository: IPaymentMethodRepository,
  ) {}

  async createPaymentMethod(input: CreatePaymentMethodInput): Promise<PaymentMethodEntity> {
    const paymentMethod = PaymentMethodEntity.create({
      name: input.name,
      description: input.description,
      type: input.type,
      config: input.config,
      testBaseUrl: input.testBaseUrl,
      productionBaseUrl: input.productionBaseUrl,
    });

    return this.paymentMethodRepository.create(paymentMethod);
  }

  async findById(id: UUID): Promise<PaymentMethodEntity | null> {
    return this.paymentMethodRepository.findById(id);
  }

  async findAll(page = 1, limit = 20) {
    return this.paymentMethodRepository.findAll({ page, limit });
  }

  async findByType(type: PaymentMethodTypeEnum): Promise<PaymentMethodEntity[]> {
    return this.paymentMethodRepository.findByType(type);
  }

  async findActiveByType(type: PaymentMethodTypeEnum): Promise<PaymentMethodEntity[]> {
    return this.paymentMethodRepository.findActiveByType(type);
  }

  async updatePaymentMethod(id: UUID, input: Partial<CreatePaymentMethodInput>): Promise<PaymentMethodEntity> {
    const paymentMethod = await this.paymentMethodRepository.findById(id);
    if (!paymentMethod) {
      throw new ApplicationError('Payment method not found', ERROR_CODES.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
    }

    if (input.description) paymentMethod.updateDescription(input.description);
    if (input.config) {
      paymentMethod.updateConfig(input.config);
    }
    if (input.testBaseUrl && input.productionBaseUrl) {
      paymentMethod.updateBaseUrls(input.testBaseUrl, input.productionBaseUrl);
    }

    return this.paymentMethodRepository.update(paymentMethod);
  }

  async deactivatePaymentMethod(id: UUID): Promise<PaymentMethodEntity> {
    const paymentMethod = await this.paymentMethodRepository.findById(id);
    if (!paymentMethod) {
      throw new ApplicationError('Payment method not found', ERROR_CODES.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
    }
    paymentMethod.deactivate();
    return this.paymentMethodRepository.update(paymentMethod);
  }

  async activatePaymentMethod(id: UUID): Promise<PaymentMethodEntity> {
    const paymentMethod = await this.paymentMethodRepository.findById(id);
    if (!paymentMethod) {
      throw new ApplicationError('Payment method not found', ERROR_CODES.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
    }
    paymentMethod.activate();
    return this.paymentMethodRepository.update(paymentMethod);
  }

  getConfiguredProviders(): { mpesa: MpesaConfig; pesaflow: PesaFlowConfig } | null {
    return null;
  }
}