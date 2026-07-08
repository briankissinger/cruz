import { injectable } from 'inversify';
import { eq, and, isNull, count, desc } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { applications } from '../models/schema.js';
import { getDb } from '../connection.js';
import { BaseDrizzleRepository } from './base.repository.js';
import type { UUID } from '../../../core/domain/base.entity.js';
import { ApplicationEntity, type PaymentMethodConfig } from '../../../core/domain/application.entity.js';
import type { IApplicationRepository, PaginatedResult, PaginationParams } from '../../../core/interfaces/repository/index.js';
import type { Application, NewApplication } from '../models/schema.js';

function mapDbToEntity(dbApp: Application): ApplicationEntity {
  return new ApplicationEntity({
    id: dbApp.id as UUID,
    customerId: dbApp.customerId as UUID,
    paymentMethodId: dbApp.paymentMethodId as UUID,
    name: dbApp.name,
    description: dbApp.description ?? '',
    config: dbApp.config as PaymentMethodConfig,
    isActive: dbApp.isActive,
    createdAt: dbApp.createdAt,
    updatedAt: dbApp.updatedAt,
    deletedAt: dbApp.deletedAt ?? undefined,
  });
}

function mapEntityToDb(entity: ApplicationEntity): NewApplication {
  return {
    id: entity.id,
    customerId: entity.customerId,
    paymentMethodId: entity.paymentMethodId,
    name: entity.name,
    description: entity.description,
    config: entity.config as any,
    isActive: entity.isActive,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
    deletedAt: entity.deletedAt ?? null,
  };
}

@injectable()
export class DrizzleApplicationRepository extends BaseDrizzleRepository implements IApplicationRepository {
  protected table = applications;

  constructor() {
    super();
  }

  async findById(id: UUID): Promise<ApplicationEntity | null> {
    const result = await super.findById(id) as Application | null;
    if (!result) return null;
    return mapDbToEntity(result);
  }

  async findAll(pagination?: PaginationParams): Promise<PaginatedResult<ApplicationEntity>> {
    const result = await super.findAll(pagination) as PaginatedResult<Application>;
    return {
      ...result,
      data: result.data.map(mapDbToEntity),
    };
  }

  async findByCustomerId(customerId: UUID, pagination?: PaginationParams): Promise<PaginatedResult<ApplicationEntity>> {
    const result = await this.paginateWhere([eq(applications.customerId, customerId)], pagination) as PaginatedResult<Application>;
    return { ...result, data: result.data.map(mapDbToEntity) };
  }

  async findByPaymentMethodId(paymentMethodId: UUID): Promise<ApplicationEntity[]> {
    const results = await this.db.select().from(applications)
      .where(and(eq(applications.paymentMethodId, paymentMethodId), isNull(applications.deletedAt)))
      .orderBy(desc(applications.createdAt)) as Application[];
    return results.map(mapDbToEntity);
  }

  async findByCustomerAndPaymentMethod(customerId: UUID, paymentMethodId: UUID): Promise<ApplicationEntity | null> {
    const [result] = await this.db.select().from(applications)
      .where(and(eq(applications.customerId, customerId), eq(applications.paymentMethodId, paymentMethodId), isNull(applications.deletedAt)))
      .limit(1) as Application[];
    if (!result) return null;
    return mapDbToEntity(result);
  }

  async getWithPaymentMethod(applicationId: UUID): Promise<ApplicationEntity | null> {
    return this.findById(applicationId);
  }

  async create(entity: ApplicationEntity): Promise<ApplicationEntity> {
    const dbApp = mapEntityToDb(entity);
    await this.db.insert(applications).values(dbApp);
    return entity;
  }

  async update(entity: ApplicationEntity): Promise<ApplicationEntity> {
    const dbApp = mapEntityToDb(entity);
    await this.db.update(applications).set(dbApp).where(eq(applications.id, dbApp.id!));
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
