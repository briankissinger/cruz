import { BaseEntity, generateUUID } from './base.entity.js';
import type { UUID } from './base.entity.js';

export enum TransactionStatusEnum {
  PENDING = 0,
  PROCESSING = 1,
  COMPLETED = 2,
  FAILED = 3,
  REFUNDED = 4,
  CANCELLED = 5,
}

export type TransactionStatusValue = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded' | 'cancelled';

export const TransactionStatus: Record<TransactionStatusEnum, TransactionStatusValue> = {
  [TransactionStatusEnum.PENDING]: 'pending',
  [TransactionStatusEnum.PROCESSING]: 'processing',
  [TransactionStatusEnum.COMPLETED]: 'completed',
  [TransactionStatusEnum.FAILED]: 'failed',
  [TransactionStatusEnum.REFUNDED]: 'refunded',
  [TransactionStatusEnum.CANCELLED]: 'cancelled',
};

export interface TransactionEntityProps {
  id: UUID;
  customerId: UUID;
  applicationId: UUID;
  invoiceNumber: string;
  merchantRequestId: string;
  checkoutRequestId: string;
  amount: number;
  paymentMethodId: UUID;
  status?: TransactionStatusEnum;
  transactionCode?: string;
  payeeName?: string;
  payeeAccount?: string;
  paymentDescription?: string;
  actualAmount?: number;
  resultCode?: string;
  providerResponse?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export class TransactionEntity extends BaseEntity {
  public readonly customerId: UUID;
  public readonly applicationId: UUID;
  public readonly invoiceNumber: string;
  public readonly merchantRequestId: string;
  public readonly checkoutRequestId: string;
  public readonly amount: number;
  public readonly paymentMethodId: UUID;
  public status: TransactionStatusEnum;
  public transactionCode?: string;
  public payeeName?: string;
  public payeeAccount?: string;
  public paymentDescription?: string;
  public actualAmount?: number;
  public resultCode?: string;
  public providerResponse?: Record<string, unknown>;

  constructor(props: TransactionEntityProps) {
    super(props.id, props.createdAt, props.updatedAt, props.deletedAt);
    this.customerId = props.customerId;
    this.applicationId = props.applicationId;
    this.invoiceNumber = props.invoiceNumber;
    this.merchantRequestId = props.merchantRequestId;
    this.checkoutRequestId = props.checkoutRequestId;
    this.amount = props.amount;
    this.paymentMethodId = props.paymentMethodId;
    this.status = props.status ?? TransactionStatusEnum.PENDING;
    this.transactionCode = props.transactionCode;
    this.payeeName = props.payeeName;
    this.payeeAccount = props.payeeAccount;
    this.paymentDescription = props.paymentDescription;
    this.actualAmount = props.actualAmount;
    this.resultCode = props.resultCode;
    this.providerResponse = props.providerResponse;
  }

  public static create(props: Omit<TransactionEntityProps, 'id' | 'createdAt' | 'updatedAt'>): TransactionEntity {
    return new TransactionEntity({
      ...props,
      id: generateUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  public markAsProcessing(): void {
    this.status = TransactionStatusEnum.PROCESSING;
    this.updatedAt = new Date();
  }

  public markAsCompleted(details: {
    transactionCode: string;
    actualAmount: number;
    resultCode: string;
    providerResponse: Record<string, unknown>;
  }): void {
    this.status = TransactionStatusEnum.COMPLETED;
    this.transactionCode = details.transactionCode;
    this.actualAmount = details.actualAmount;
    this.resultCode = details.resultCode;
    this.providerResponse = details.providerResponse;
    this.updatedAt = new Date();
  }

  public markAsFailed(details: {
    resultCode: string;
    providerResponse: Record<string, unknown>;
  }): void {
    this.status = TransactionStatusEnum.FAILED;
    this.resultCode = details.resultCode;
    this.providerResponse = details.providerResponse;
    this.updatedAt = new Date();
  }

  public markAsRefunded(): void {
    this.status = TransactionStatusEnum.REFUNDED;
    this.updatedAt = new Date();
  }

  public isTerminal(): boolean {
    return this.status === TransactionStatusEnum.COMPLETED
      || this.status === TransactionStatusEnum.FAILED
      || this.status === TransactionStatusEnum.CANCELLED
      || this.status === TransactionStatusEnum.REFUNDED;
  }

  public getStatusLabel(): TransactionStatusValue {
    return TransactionStatus[this.status];
  }

  public isPending(): boolean {
    return this.status === TransactionStatusEnum.PENDING;
  }

  public isCompleted(): boolean {
    return this.status === TransactionStatusEnum.COMPLETED;
  }

  public toPublicObject(): Omit<TransactionEntityProps, 'providerResponse'> & { statusLabel: TransactionStatusValue } {
    return {
      id: this.id,
      customerId: this.customerId,
      applicationId: this.applicationId,
      invoiceNumber: this.invoiceNumber,
      merchantRequestId: this.merchantRequestId,
      checkoutRequestId: this.checkoutRequestId,
      amount: this.amount,
      paymentMethodId: this.paymentMethodId,
      status: this.status,
      statusLabel: this.getStatusLabel(),
      transactionCode: this.transactionCode,
      payeeName: this.payeeName,
      payeeAccount: this.payeeAccount,
      paymentDescription: this.paymentDescription,
      actualAmount: this.actualAmount,
      resultCode: this.resultCode,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      deletedAt: this.deletedAt,
    };
  }
}
