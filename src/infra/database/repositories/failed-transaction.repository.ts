import { injectable } from 'inversify';
import { eq, and, isNull, count, desc } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { failedTransactions } from '../models/schema.js';
import { getDb } from '../connection.js';
import { BaseDrizzleRepository } from './base.repository.js';
import type { UUID } from '../../../core/domain/base.entity.js';
import { FailedTransactionEntity } from '../../../core/domain/failed-transaction.entity.js';
import { TransactionStatusEnum } from '../../../core/domain/transaction.entity.js';
import type { IFailedTransactionRepository, PaginatedResult, PaginationParams } from '../../../core/interfaces/repository/index.js';
import type { FailedTransaction, NewFailedTransaction } from '../models/schema.js';

const statusMap: Record<string, TransactionStatusEnum> = {
  pending: TransactionStatusEnum.PENDING,
  processing: TransactionStatusEnum.PROCESSING,
  completed: TransactionStatusEnum.COMPLETED,
  failed: TransactionStatusEnum.FAILED,
  refunded: TransactionStatusEnum.REFUNDED,
  cancelled: TransactionStatusEnum.CANCELLED,
};

function mapDbToEntity(dbFt: FailedTransaction): FailedTransactionEntity {
  return new FailedTransactionEntity({
    id: dbFt.id as UUID,
    customerId: dbFt.customerId as UUID,
    applicationId: dbFt.applicationId as UUID,
    invoiceNumber: dbFt.invoiceNumber,
    merchantRequestId: dbFt.merchantRequestId,
    checkoutRequestId: dbFt.checkoutRequestId,
    amount: dbFt.amount,
    paymentMethodId: dbFt.paymentMethodId as UUID,
    status: statusMap[dbFt.status] ?? TransactionStatusEnum.FAILED,
    transactionCode: dbFt.transactionCode ?? undefined,
    payeeName: dbFt.payeeName ?? undefined,
    payeeAccount: dbFt.payeeAccount ?? undefined,
    paymentDescription: dbFt.paymentDescription ?? undefined,
    actualAmount: dbFt.actualAmount ?? undefined,
    resultCode: dbFt.resultCode ?? undefined,
    providerResponse: dbFt.providerResponse as Record<string, unknown> | undefined,
    failureReason: dbFt.failureReason,
    failedAt: dbFt.failedAt,
    createdAt: dbFt.createdAt,
    updatedAt: dbFt.updatedAt,
    deletedAt: dbFt.deletedAt ?? undefined,
  });
}

function mapEntityToDb(entity: FailedTransactionEntity): NewFailedTransaction {
  const statusReverse: Record<TransactionStatusEnum, string> = {
    [TransactionStatusEnum.PENDING]: 'pending',
    [TransactionStatusEnum.PROCESSING]: 'processing',
    [TransactionStatusEnum.COMPLETED]: 'completed',
    [TransactionStatusEnum.FAILED]: 'failed',
    [TransactionStatusEnum.REFUNDED]: 'refunded',
    [TransactionStatusEnum.CANCELLED]: 'cancelled',
  };
  return {
    id: entity.id,
    customerId: entity.customerId,
    applicationId: entity.applicationId,
    invoiceNumber: entity.invoiceNumber,
    merchantRequestId: entity.merchantRequestId,
    checkoutRequestId: entity.checkoutRequestId,
    amount: entity.amount,
    paymentMethodId: entity.paymentMethodId,
    status: statusReverse[entity.status] as any,
    transactionCode: entity.transactionCode ?? null,
    payeeName: entity.payeeName ?? null,
    payeeAccount: entity.payeeAccount ?? null,
    paymentDescription: entity.paymentDescription ?? null,
    actualAmount: entity.actualAmount ?? null,
    resultCode: entity.resultCode ?? null,
    providerResponse: entity.providerResponse as any ?? null,
    failureReason: entity.failureReason,
    failedAt: entity.failedAt,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
    deletedAt: entity.deletedAt ?? null,
  };
}

@injectable()
export class DrizzleFailedTransactionRepository extends BaseDrizzleRepository implements IFailedTransactionRepository {
  protected table = failedTransactions;

  constructor() {
    super();
  }

  async findById(id: UUID): Promise<FailedTransactionEntity | null> {
    const result = await super.findById(id) as FailedTransaction | null;
    if (!result) return null;
    return mapDbToEntity(result);
  }

  async findAll(pagination?: PaginationParams): Promise<PaginatedResult<FailedTransactionEntity>> {
    const result = await super.findAll(pagination) as PaginatedResult<FailedTransaction>;
    return { ...result, data: result.data.map(mapDbToEntity) };
  }

  async findByCustomerId(customerId: UUID, pagination?: PaginationParams): Promise<PaginatedResult<FailedTransactionEntity>> {
    const result = await this.paginateWhere([eq(failedTransactions.customerId, customerId)], pagination) as PaginatedResult<FailedTransaction>;
    return { ...result, data: result.data.map(mapDbToEntity) };
  }

  async findByOriginalTransactionId(transactionId: UUID): Promise<FailedTransactionEntity | null> {
    const [result] = await this.db.select().from(failedTransactions)
      .where(and(eq(failedTransactions.merchantRequestId, transactionId), isNull(failedTransactions.deletedAt)))
      .limit(1) as FailedTransaction[];
    if (!result) return null;
    return mapDbToEntity(result);
  }

  async create(entity: FailedTransactionEntity): Promise<FailedTransactionEntity> {
    const dbFt = mapEntityToDb(entity);
    await this.db.insert(failedTransactions).values(dbFt);
    return entity;
  }

  async update(entity: FailedTransactionEntity): Promise<FailedTransactionEntity> {
    const dbFt = mapEntityToDb(entity);
    await this.db.update(failedTransactions).set(dbFt).where(eq(failedTransactions.id, dbFt.id!));
    return entity;
  }

  async delete(id: UUID): Promise<boolean> {
    return super.delete(id);
  }

  async softDelete(id: UUID): Promise<boolean> {
    return super.softDelete(id);
  }

  async restore(id: UUID): Promise<boolean> {
    return super.restore(id);
  }
}
