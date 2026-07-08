import { injectable } from 'inversify';
import { eq, and, isNull, or, count, desc } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { users } from '../models/schema.js';
import { BaseDrizzleRepository } from './base.repository.js';
import { getDb } from '../connection.js';
import type { UUID } from '../../../core/domain/base.entity.js';
import { UserEntity, UserStatusEnum } from '../../../core/domain/user.entity.js';
import type { IUserRepository, PaginatedResult, PaginationParams } from '../../../core/interfaces/repository/index.js';
import type { User, NewUser } from '../models/schema.js';

function mapDbToEntity(dbUser: User): UserEntity {
  const statusMap: Record<string, UserStatusEnum> = {
    active: UserStatusEnum.ACTIVE,
    inactive: UserStatusEnum.INACTIVE,
    suspended: UserStatusEnum.SUSPENDED,
  };
  return new UserEntity({
    id: dbUser.id as UUID,
    name: dbUser.name,
    email: dbUser.email,
    passwordHash: dbUser.passwordHash,
    status: statusMap[dbUser.status] ?? UserStatusEnum.ACTIVE,
    createdAt: dbUser.createdAt,
    updatedAt: dbUser.updatedAt,
    deletedAt: dbUser.deletedAt ?? undefined,
  });
}

function mapEntityToDb(entity: UserEntity): NewUser {
  const statusMap: Record<UserStatusEnum, string> = {
    [UserStatusEnum.ACTIVE]: 'active',
    [UserStatusEnum.INACTIVE]: 'inactive',
    [UserStatusEnum.SUSPENDED]: 'suspended',
  };
  return {
    id: entity.id,
    name: entity.name,
    email: entity.email,
    passwordHash: entity.passwordHash,
    status: statusMap[entity.status] as any,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
    deletedAt: entity.deletedAt ?? null,
  };
}

@injectable()
export class DrizzleUserRepository extends BaseDrizzleRepository implements IUserRepository {
  protected table = users;

  constructor() {
    super();
  }

  async findById(id: UUID): Promise<UserEntity | null> {
    const result = await super.findById(id) as User | null;
    if (!result) return null;
    return mapDbToEntity(result);
  }

  async findAll(pagination?: PaginationParams): Promise<PaginatedResult<UserEntity>> {
    const result = await super.findAll(pagination) as PaginatedResult<User>;
    return {
      ...result,
      data: result.data.map(mapDbToEntity),
    };
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    const [result] = await this.db.select().from(users)
      .where(and(
        eq(users.email, email.toLowerCase()),
        isNull(users.deletedAt)
      ))
      .limit(1) as User[];
    if (!result) return null;
    return mapDbToEntity(result);
  }

  async findByStatus(status: UserStatusEnum, pagination?: PaginationParams): Promise<PaginatedResult<UserEntity>> {
    const statusMap: Record<UserStatusEnum, string> = {
      [UserStatusEnum.ACTIVE]: 'active',
      [UserStatusEnum.INACTIVE]: 'inactive',
      [UserStatusEnum.SUSPENDED]: 'suspended',
    };

    const result = await this.paginateWhere([eq(users.status, statusMap[status] as any)], pagination) as PaginatedResult<User>;
    return {
      ...result,
      data: result.data.map(mapDbToEntity),
    };
  }

  async existsByEmail(email: string): Promise<boolean> {
    const [result] = await this.db.select({ exists: 1 as any }).from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1) as any[];
    return !!result;
  }

  async create(entity: UserEntity): Promise<UserEntity> {
    const dbUser = mapEntityToDb(entity);
    await this.db.insert(users).values(dbUser);
    return entity;
  }

  async update(entity: UserEntity): Promise<UserEntity> {
    const dbUser = mapEntityToDb(entity);
    await this.db.update(users).set(dbUser).where(eq(users.id, dbUser.id!));
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
