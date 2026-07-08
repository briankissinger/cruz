import { injectable } from 'inversify';
import { eq, and, isNull, count, desc } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { transactions } from '../models/schema.js';
import { getDb } from '../connection.js';
import { BaseDrizzleRepository } from './base.repository.js';
import type { UUID } from '../../../core/domain/base.entity.js';
import { TransactionEntity, TransactionStatusEnum } from '../../../core/domain/transaction.entity.js';
import type { ITransactionRepository, PaginatedResult, PaginationParams } from '../../../core/interfaces/repository/index.js';
import type { Transaction, NewTransaction } from '../models/schema.js';

const statusMapToEnum: Record<string, TransactionStatusEnum> = {
  pending: TransactionStatusEnum.PENDING,
  processing: TransactionStatusEnum.PROCESSING,
  completed: TransactionStatusEnum.COMPLETED,
  failed: TransactionStatusEnum.FAILED,
  refunded: TransactionStatusEnum.REFUNDED,
  cancelled: TransactionStatusEnum.CANCELLED,
};

const statusMapToDb: Record<TransactionStatusEnum, string> = {
  [TransactionStatusEnum.PENDING]: 'pending',
  [TransactionStatusEnum.PROCESSING]: 'processing',
  [TransactionStatusEnum.COMPLETED]: 'completed',
  [TransactionStatusEnum.FAILED]: 'failed',
  [TransactionStatusEnum.REFUNDED]: 'refunded',
  [TransactionStatusEnum.CANCELLED]: 'cancelled',
};

function mapDbToEntity(dbTx: Transaction): TransactionEntity {
  return new TransactionEntity({
    id: dbTx.id as UUID,
    customerId: dbTx.customerId as UUID,
    applicationId: dbTx.applicationId as UUID,
    invoiceNumber: dbTx.invoiceNumber,
    merchantRequestId: dbTx.merchantRequestId,
    checkoutRequestId: dbTx.checkoutRequestId,
    amount: dbTx.amount,
    paymentMethodId: dbTx.paymentMethodId as UUID,
    status: statusMapToEnum[dbTx.status] ?? TransactionStatusEnum.PENDING,
    transactionCode: dbTx.transactionCode ?? undefined,
    payeeName: dbTx.payeeName ?? undefined,
    payeeAccount: dbTx.payeeAccount ?? undefined,
    paymentDescription: dbTx.paymentDescription ?? undefined,
    actualAmount: dbTx.actualAmount ?? undefined,
    resultCode: dbTx.resultCode ?? undefined,
    providerResponse: dbTx.providerResponse as Record<string, unknown> | undefined,
    createdAt: dbTx.createdAt,
    updatedAt: dbTx.updatedAt,
    deletedAt: dbTx.deletedAt ?? undefined,
  });
}

function mapEntityToDb(entity: TransactionEntity): NewTransaction {
  return {
    id: entity.id,
    customerId: entity.customerId,
    applicationId: entity.applicationId,
    invoiceNumber: entity.invoiceNumber,
    merchantRequestId: entity.merchantRequestId,
    checkoutRequestId: entity.checkoutRequestId,
    amount: entity.amount,
    paymentMethodId: entity.paymentMethodId,
    status: statusMapToDb[entity.status] as any,
    transactionCode: entity.transactionCode ?? null,
    payeeName: entity.payeeName ?? null,
    payeeAccount: entity.payeeAccount ?? null,
    paymentDescription: entity.paymentDescription ?? null,
    actualAmount: entity.actualAmount ?? null,
    resultCode: entity.resultCode ?? null,
    providerResponse: entity.providerResponse as any ?? null,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
    deletedAt: entity.deletedAt ?? null,
  };
}

@injectable()
export class DrizzleTransactionRepository extends BaseDrizzleRepository implements ITransactionRepository {
  protected table = transactions;

  constructor() {
    super();
  }

  async findById(id: UUID): Promise<TransactionEntity | null> {
    const result = await super.findById(id) as Transaction | null;
    if (!result) return null;
    return mapDbToEntity(result);
  }

  async findAll(pagination?: PaginationParams): Promise<PaginatedResult<TransactionEntity>> {
    const result = await super.findAll(pagination) as PaginatedResult<Transaction>;
    return { ...result, data: result.data.map(mapDbToEntity) };
  }

  async findByCustomerId(customerId: UUID, pagination?: PaginationParams): Promise<PaginatedResult<TransactionEntity>> {
    const result = await this.paginateWhere([eq(transactions.customerId, customerId)], pagination) as PaginatedResult<Transaction>;
    return { ...result, data: result.data.map(mapDbToEntity) };
  }

  async findByMerchantRequestId(merchantRequestId: string): Promise<TransactionEntity | null> {
    const [result] = await this.db.select().from(transactions).where(and(eq(transactions.merchantRequestId, merchantRequestId), isNull(transactions.deletedAt))).limit(1) as Transaction[];
    if (!result) return null;
    return mapDbToEntity(result);
  }

  async findByCheckoutRequestId(checkoutRequestId: string): Promise<TransactionEntity | null> {
    const [result] = await this.db.select().from(transactions).where(and(eq(transactions.checkoutRequestId, checkoutRequestId), isNull(transactions.deletedAt))).limit(1) as Transaction[];
    if (!result) return null;
    return mapDbToEntity(result);
  }

  async findByMerchantAndCheckoutIds(merchantRequestId: string, checkoutRequestId: string): Promise<TransactionEntity | null> {
    const [result] = await this.db.select().from(transactions)
      .where(and(eq(transactions.merchantRequestId, merchantRequestId), eq(transactions.checkoutRequestId, checkoutRequestId), isNull(transactions.deletedAt)))
      .limit(1) as Transaction[];
    if (!result) return null;
    return mapDbToEntity(result);
  }

  async findByStatus(status: TransactionStatusEnum, pagination?: PaginationParams): Promise<PaginatedResult<TransactionEntity>> {
    const result = await this.paginateWhere([eq(transactions.status, statusMapToDb[status] as any)], pagination) as PaginatedResult<Transaction>;
    return { ...result, data: result.data.map(mapDbToEntity) };
  }

  async findPendingByCustomerId(customerId: UUID): Promise<TransactionEntity[]> {
    const results = await this.db.select().from(transactions)
      .where(and(eq(transactions.customerId, customerId), eq(transactions.status, 'pending'), isNull(transactions.deletedAt)))
      .orderBy(desc(transactions.createdAt)) as Transaction[];
    return results.map(mapDbToEntity);
  }

  async getWithCustomer(transactionId: UUID): Promise<TransactionEntity | null> {
    return this.findById(transactionId);
  }

  async getWithPaymentMethod(transactionId: UUID): Promise<TransactionEntity | null> {
    return this.findById(transactionId);
  }

  async create(entity: TransactionEntity): Promise<TransactionEntity> {
    const dbTx = mapEntityToDb(entity);
    await this.db.insert(transactions).values(dbTx);
    return entity;
  }

  async update(entity: TransactionEntity): Promise<TransactionEntity> {
    const dbTx = mapEntityToDb(entity);
    await this.db.update(transactions).set(dbTx).where(eq(transactions.id, dbTx.id!));
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
