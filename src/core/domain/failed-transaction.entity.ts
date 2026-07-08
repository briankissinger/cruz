import { BaseEntity, generateUUID } from './base.entity.js';
import type { UUID } from './base.entity.js';
import { TransactionEntity, TransactionStatusEnum } from './transaction.entity.js';

export interface FailedTransactionEntityProps {
  id: UUID;
  customerId: UUID;
  applicationId: UUID;
  invoiceNumber: string;
  merchantRequestId: string;
  checkoutRequestId: string;
  amount: number;
  paymentMethodId: UUID;
  status: TransactionStatusEnum;
  transactionCode?: string;
  payeeName?: string;
  payeeAccount?: string;
  paymentDescription?: string;
  actualAmount?: number;
  resultCode?: string;
  providerResponse?: Record<string, unknown>;
  failureReason: string;
  failedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export class FailedTransactionEntity extends BaseEntity {
  public readonly customerId: UUID;
  public readonly applicationId: UUID;
  public readonly invoiceNumber: string;
  public readonly merchantRequestId: string;
  public readonly checkoutRequestId: string;
  public readonly amount: number;
  public readonly paymentMethodId: UUID;
  public readonly status: TransactionStatusEnum;
  public transactionCode?: string;
  public payeeName?: string;
  public payeeAccount?: string;
  public paymentDescription?: string;
  public actualAmount?: number;
  public resultCode?: string;
  public providerResponse?: Record<string, unknown>;
  public readonly failureReason: string;
  public readonly failedAt: Date;

  constructor(props: FailedTransactionEntityProps) {
    super(props.id, props.createdAt, props.updatedAt, props.deletedAt);
    this.customerId = props.customerId;
    this.applicationId = props.applicationId;
    this.invoiceNumber = props.invoiceNumber;
    this.merchantRequestId = props.merchantRequestId;
    this.checkoutRequestId = props.checkoutRequestId;
    this.amount = props.amount;
    this.paymentMethodId = props.paymentMethodId;
    this.status = props.status;
    this.transactionCode = props.transactionCode;
    this.payeeName = props.payeeName;
    this.payeeAccount = props.payeeAccount;
    this.paymentDescription = props.paymentDescription;
    this.actualAmount = props.actualAmount;
    this.resultCode = props.resultCode;
    this.providerResponse = props.providerResponse;
    this.failureReason = props.failureReason;
    this.failedAt = props.failedAt;
  }

  public static create(props: Omit<FailedTransactionEntityProps, 'id' | 'createdAt' | 'updatedAt'>): FailedTransactionEntity {
    return new FailedTransactionEntity({
      ...props,
      id: generateUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  public static createFromTransaction(transaction: TransactionEntity, failureReason: string): FailedTransactionEntity {
    return FailedTransactionEntity.create({
      customerId: transaction.customerId,
      applicationId: transaction.applicationId,
      invoiceNumber: transaction.invoiceNumber,
      merchantRequestId: transaction.merchantRequestId,
      checkoutRequestId: transaction.checkoutRequestId,
      amount: transaction.amount,
      paymentMethodId: transaction.paymentMethodId,
      status: TransactionStatusEnum.FAILED,
      transactionCode: transaction.transactionCode,
      payeeName: transaction.payeeName,
      payeeAccount: transaction.payeeAccount,
      paymentDescription: transaction.paymentDescription,
      actualAmount: transaction.actualAmount,
      resultCode: transaction.resultCode ?? failureReason,
      providerResponse: transaction.providerResponse,
      failureReason,
      failedAt: new Date(),
    });
  }
}
