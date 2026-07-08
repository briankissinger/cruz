import { injectable } from 'inversify';
import { eq, and, isNull, or, count, desc } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { customers } from '../models/schema.js';
import { BaseDrizzleRepository } from './base.repository.js';
import { getDb } from '../connection.js';
import type { UUID } from '../../../core/domain/base.entity.js';
import { CustomerEntity } from '../../../core/domain/customer.entity.js';
import type { ICustomerRepository, PaginatedResult, PaginationParams } from '../../../core/interfaces/repository/index.js';
import type { Customer, NewCustomer } from '../models/schema.js';

function mapDbToEntity(dbCustomer: Customer): CustomerEntity {
  return new CustomerEntity({
    id: dbCustomer.id as UUID,
    userId: dbCustomer.userId as UUID,
    clientId: dbCustomer.clientId,
    clientSecret: dbCustomer.clientSecret,
    apiKey: dbCustomer.apiKey,
    name: dbCustomer.name,
    createdAt: dbCustomer.createdAt,
    updatedAt: dbCustomer.updatedAt,
    deletedAt: dbCustomer.deletedAt ?? undefined,
  });
}

function mapEntityToDb(entity: CustomerEntity): NewCustomer {
  return {
    id: entity.id,
    userId: entity.userId,
    clientId: entity.clientId,
    clientSecret: entity.clientSecret,
    apiKey: entity.apiKey,
    name: entity.name,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
    deletedAt: entity.deletedAt ?? null,
  };
}

@injectable()
export class DrizzleCustomerRepository extends BaseDrizzleRepository implements ICustomerRepository {
  protected table = customers;

  constructor() {
    super();
  }

  async findById(id: UUID): Promise<CustomerEntity | null> {
    const result = await super.findById(id) as Customer | null;
    if (!result) return null;
    return mapDbToEntity(result);
  }

  async findAll(pagination?: PaginationParams): Promise<PaginatedResult<CustomerEntity>> {
    const result = await super.findAll(pagination) as PaginatedResult<Customer>;
    return {
      ...result,
      data: result.data.map(mapDbToEntity),
    };
  }

  async findByUserId(userId: UUID): Promise<CustomerEntity | null> {
    const [result] = await this.db.select().from(customers)
      .where(and(eq(customers.userId, userId), isNull(customers.deletedAt)))
      .limit(1) as Customer[];
    if (!result) return null;
    return mapDbToEntity(result);
  }

  async findByClientId(clientId: string): Promise<CustomerEntity | null> {
    const [result] = await this.db.select().from(customers)
      .where(and(eq(customers.clientId, clientId), isNull(customers.deletedAt)))
      .limit(1) as Customer[];
    if (!result) return null;
    return mapDbToEntity(result);
  }

  async findByApiKey(apiKey: string): Promise<CustomerEntity | null> {
    const [result] = await this.db.select().from(customers)
      .where(and(eq(customers.apiKey, apiKey), isNull(customers.deletedAt)))
      .limit(1) as Customer[];
    if (!result) return null;
    return mapDbToEntity(result);
  }

  async findByApiKeyHash(apiKeyHash: string): Promise<CustomerEntity | null> {
    const [result] = await this.db.select().from(customers)
      .where(and(eq(customers.apiKey, apiKeyHash), isNull(customers.deletedAt)))
      .limit(1) as Customer[];
    if (!result) return null;
    return mapDbToEntity(result);
  }

  async getWithApplications(customerId: UUID): Promise<CustomerEntity | null> {
    return this.findById(customerId);
  }

  async create(entity: CustomerEntity): Promise<CustomerEntity> {
    const dbCustomer = mapEntityToDb(entity);
    await this.db.insert(customers).values(dbCustomer);
    return entity;
  }

  async update(entity: CustomerEntity): Promise<CustomerEntity> {
    const dbCustomer = mapEntityToDb(entity);
    await this.db.update(customers).set(dbCustomer).where(eq(customers.id, dbCustomer.id!));
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