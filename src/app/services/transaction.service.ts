import { inject, injectable } from 'inversify';
import { TYPES } from '../../infra/config/inversify.config.js';
import type { ITransactionRepository, IFailedTransactionRepository, ICustomerRepository, IApplicationRepository } from '../../core/interfaces/repository/index.js';
import { TransactionEntity, TransactionStatusEnum } from '../../core/domain/transaction.entity.js';
import { FailedTransactionEntity } from '../../core/domain/failed-transaction.entity.js';
import type { UUID } from '../../core/domain/base.entity.js';
import { HTTP_STATUS, ERROR_CODES } from '../../config/constants.js';
import { ApplicationError } from './authentication.service.js';

export interface InitiatePaymentInput {
  customerId: UUID;
  applicationId: UUID;
  invoiceNumber: string;
  merchantRequestId: string;
  checkoutRequestId: string;
  amount: number;
  payeeName?: string;
  payeeAccount?: string;
  paymentDescription?: string;
}

export interface CompletePaymentInput {
  merchantRequestId: string;
  checkoutRequestId: string;
  transactionCode: string;
  actualAmount: number;
  resultCode: string;
  providerResponse: Record<string, unknown>;
}

export interface FailPaymentInput {
  merchantRequestId: string;
  checkoutRequestId: string;
  resultCode: string;
  providerResponse: Record<string, unknown>;
  failureReason: string;
}

export interface WebhookForwardPayload {
  transactionId: string;
  customerId: string;
  status: string;
  merchantRequestId: string;
  checkoutRequestId: string;
  transactionCode?: string;
  actualAmount?: number;
  resultCode?: string;
  timestamp: string;
}

@injectable()
export class TransactionService {
  constructor(
    @inject(TYPES.TransactionRepository) private transactionRepository: ITransactionRepository,
    @inject(TYPES.FailedTransactionRepository) private failedTransactionRepository: IFailedTransactionRepository,
    @inject(TYPES.CustomerRepository) private customerRepository: ICustomerRepository,
    @inject(TYPES.ApplicationRepository) private applicationRepository: IApplicationRepository,
  ) {}

  async initiatePayment(input: InitiatePaymentInput): Promise<TransactionEntity> {
    const existing = await this.transactionRepository.findByMerchantAndCheckoutIds(
      input.merchantRequestId,
      input.checkoutRequestId,
    );

    if (existing) {
      throw new ApplicationError(
        'Transaction with these merchant and checkout IDs already exists',
        ERROR_CODES.CONFLICT,
        HTTP_STATUS.CONFLICT,
      );
    }

    const customer = await this.customerRepository.findById(input.customerId);
    if (!customer) {
      throw new ApplicationError('Customer not found', ERROR_CODES.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
    }

    const application = await this.applicationRepository.findById(input.applicationId);
    if (!application) {
      throw new ApplicationError('Application not found', ERROR_CODES.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
    }

    if (application.customerId !== input.customerId) {
      throw new ApplicationError('Application does not belong to this customer', ERROR_CODES.AUTHORIZATION_FAILED, HTTP_STATUS.FORBIDDEN);
    }

    if (!application.isActive) {
      throw new ApplicationError('Application is inactive', ERROR_CODES.VALIDATION_ERROR, HTTP_STATUS.UNPROCESSABLE_ENTITY);
    }

    const transaction = TransactionEntity.create({
      customerId: input.customerId,
      applicationId: input.applicationId,
      invoiceNumber: input.invoiceNumber,
      merchantRequestId: input.merchantRequestId,
      checkoutRequestId: input.checkoutRequestId,
      amount: input.amount,
      paymentMethodId: application.paymentMethodId,
      payeeName: input.payeeName,
      payeeAccount: input.payeeAccount,
      paymentDescription: input.paymentDescription,
    });

    return this.transactionRepository.create(transaction);
  }

  async markPaymentProcessing(transaction: TransactionEntity): Promise<TransactionEntity> {
    transaction.markAsProcessing();
    return this.transactionRepository.update(transaction);
  }

  async completePayment(input: CompletePaymentInput): Promise<TransactionEntity> {
    const transaction = await this.transactionRepository.findByMerchantAndCheckoutIds(
      input.merchantRequestId,
      input.checkoutRequestId,
    );

    if (!transaction) {
      throw new ApplicationError(
        'Transaction not found',
        ERROR_CODES.NOT_FOUND,
        HTTP_STATUS.NOT_FOUND,
      );
    }

    if (transaction.isTerminal()) {
      throw new ApplicationError(
        'Transaction is already in a terminal state',
        ERROR_CODES.CONFLICT,
        HTTP_STATUS.CONFLICT,
      );
    }

    transaction.markAsCompleted({
      transactionCode: input.transactionCode,
      actualAmount: input.actualAmount,
      resultCode: input.resultCode,
      providerResponse: input.providerResponse,
    });

    return this.transactionRepository.update(transaction);
  }

  async failPayment(input: FailPaymentInput): Promise<FailedTransactionEntity> {
    const transaction = await this.transactionRepository.findByMerchantAndCheckoutIds(
      input.merchantRequestId,
      input.checkoutRequestId,
    );

    if (!transaction) {
      throw new ApplicationError(
        'Transaction not found',
        ERROR_CODES.NOT_FOUND,
        HTTP_STATUS.NOT_FOUND,
      );
    }

    transaction.markAsFailed({
      resultCode: input.resultCode,
      providerResponse: input.providerResponse,
    });

    const failedTransaction = FailedTransactionEntity.createFromTransaction(transaction, input.failureReason);

    await this.failedTransactionRepository.create(failedTransaction);
    await this.transactionRepository.softDelete(transaction.id);

    return failedTransaction;
  }

  async getTransactionById(id: UUID): Promise<TransactionEntity | null> {
    return this.transactionRepository.findById(id);
  }

  async getTransactionByMerchantRequestId(merchantRequestId: string): Promise<TransactionEntity | null> {
    return this.transactionRepository.findByMerchantRequestId(merchantRequestId);
  }

  async getTransactionByCheckoutRequestId(checkoutRequestId: string): Promise<TransactionEntity | null> {
    return this.transactionRepository.findByCheckoutRequestId(checkoutRequestId);
  }

  async getTransactionByMerchantAndCheckoutIds(
    merchantRequestId: string,
    checkoutRequestId: string,
  ): Promise<TransactionEntity | null> {
    return this.transactionRepository.findByMerchantAndCheckoutIds(merchantRequestId, checkoutRequestId);
  }

  async getCustomerTransactions(customerId: UUID, page = 1, limit = 20) {
    return this.transactionRepository.findByCustomerId(customerId, { page, limit });
  }

  async buildWebhookPayload(transaction: TransactionEntity): Promise<WebhookForwardPayload> {
    return {
      transactionId: transaction.id,
      customerId: transaction.customerId,
      status: transaction.getStatusLabel(),
      merchantRequestId: transaction.merchantRequestId,
      checkoutRequestId: transaction.checkoutRequestId,
      transactionCode: transaction.transactionCode,
      actualAmount: transaction.actualAmount,
      resultCode: transaction.resultCode,
      timestamp: new Date().toISOString(),
    };
  }
}
