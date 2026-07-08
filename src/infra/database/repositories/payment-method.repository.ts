import { injectable } from 'inversify';
import { eq, and, isNull, desc } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { paymentMethods } from '../models/schema.js';
import { getDb } from '../connection.js';
import { BaseDrizzleRepository } from './base.repository.js';
import type { UUID } from '../../../core/domain/base.entity.js';
import { PaymentMethodEntity, PaymentMethodTypeEnum, type PaymentMethodConfig } from '../../../core/domain/payment-method.entity.js';
import type { IPaymentMethodRepository, PaginatedResult, PaginationParams } from '../../../core/interfaces/repository/index.js';
import type { PaymentMethod, NewPaymentMethod } from '../models/schema.js';

function mapDbTypeToEnum(type: string): PaymentMethodTypeEnum {
  switch (type) {
    case 'mpesa': return PaymentMethodTypeEnum.MPESA;
    case 'pesaflow': return PaymentMethodTypeEnum.PESAFLOW;
    default: return PaymentMethodTypeEnum.MPESA;
  }
}

function mapEnumToDbType(type: PaymentMethodTypeEnum): string {
  switch (type) {
    case PaymentMethodTypeEnum.MPESA: return 'mpesa';
    case PaymentMethodTypeEnum.PESAFLOW: return 'pesaflow';
  }
}

function mapDbToEntity(dbMethod: PaymentMethod): PaymentMethodEntity {
  return new PaymentMethodEntity({
    id: dbMethod.id as UUID,
    name: dbMethod.name,
    description: dbMethod.description ?? '',
    type: mapDbTypeToEnum(dbMethod.type),
    config: dbMethod.config as PaymentMethodConfig,
    testBaseUrl: dbMethod.testBaseUrl,
    productionBaseUrl: dbMethod.productionBaseUrl,
    isActive: dbMethod.isActive,
    createdAt: dbMethod.createdAt,
    updatedAt: dbMethod.updatedAt,
    deletedAt: dbMethod.deletedAt ?? undefined,
  });
}

function mapEntityToDb(entity: PaymentMethodEntity): NewPaymentMethod {
  return {
    id: entity.id,
    name: entity.name,
    description: entity.description,
    type: mapEnumToDbType(entity.type) as any,
    config: entity.config as any,
    testBaseUrl: entity.testBaseUrl,
    productionBaseUrl: entity.productionBaseUrl,
    isActive: entity.isActive,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
    deletedAt: entity.deletedAt ?? null,
  };
}

@injectable()
export class DrizzlePaymentMethodRepository extends BaseDrizzleRepository implements IPaymentMethodRepository {
  protected table = paymentMethods;

  constructor() {
    super();
  }

  async findById(id: UUID): Promise<PaymentMethodEntity | null> {
    const result = await super.findById(id) as PaymentMethod | null;
    if (!result) return null;
    return mapDbToEntity(result);
  }

  async findAll(pagination?: PaginationParams): Promise<PaginatedResult<PaymentMethodEntity>> {
    const result = await super.findAll(pagination) as PaginatedResult<PaymentMethod>;
    return {
      ...result,
      data: result.data.map(mapDbToEntity),
    };
  }

  async findByType(type: PaymentMethodTypeEnum): Promise<PaymentMethodEntity[]> {
    const results = await this.db.select().from(paymentMethods)
      .where(and(eq(paymentMethods.type, mapEnumToDbType(type) as any), isNull(paymentMethods.deletedAt)))
      .orderBy(desc(paymentMethods.createdAt)) as PaymentMethod[];
    return results.map(mapDbToEntity);
  }

  async findActiveByType(type: PaymentMethodTypeEnum): Promise<PaymentMethodEntity[]> {
    const results = await this.db.select().from(paymentMethods)
      .where(and(eq(paymentMethods.type, mapEnumToDbType(type) as any), eq(paymentMethods.isActive, true), isNull(paymentMethods.deletedAt)))
      .orderBy(desc(paymentMethods.createdAt)) as PaymentMethod[];
    return results.map(mapDbToEntity);
  }

  async create(entity: PaymentMethodEntity): Promise<PaymentMethodEntity> {
    const dbMethod = mapEntityToDb(entity);
    await this.db.insert(paymentMethods).values(dbMethod);
    return entity;
  }

  async update(entity: PaymentMethodEntity): Promise<PaymentMethodEntity> {
    const dbMethod = mapEntityToDb(entity);
    await this.db.update(paymentMethods).set(dbMethod).where(eq(paymentMethods.id, dbMethod.id!));
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