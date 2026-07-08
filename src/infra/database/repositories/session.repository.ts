import { injectable } from 'inversify';
import { eq, and, isNull, count, desc, lt, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { sessions } from '../models/schema.js';
import { getDb } from '../connection.js';
import { BaseDrizzleRepository } from './base.repository.js';
import type { UUID } from '../../../core/domain/base.entity.js';
import { SessionEntity, SessionStatusEnum } from '../../../core/domain/session.entity.js';
import type { ISessionRepository, PaginatedResult, PaginationParams } from '../../../core/interfaces/repository/index.js';
import type { Session, NewSession } from '../models/schema.js';

const statusMapToEnum: Record<string, SessionStatusEnum> = {
  active: SessionStatusEnum.ACTIVE,
  expired: SessionStatusEnum.EXPIRED,
  revoked: SessionStatusEnum.REVOKED,
  blacklisted: SessionStatusEnum.BLACKLISTED,
};

const statusMapToDb: Record<SessionStatusEnum, string> = {
  [SessionStatusEnum.ACTIVE]: 'active',
  [SessionStatusEnum.EXPIRED]: 'expired',
  [SessionStatusEnum.REVOKED]: 'revoked',
  [SessionStatusEnum.BLACKLISTED]: 'blacklisted',
};

function mapDbToEntity(dbSession: Session): SessionEntity {
  return new SessionEntity({
    id: dbSession.id as UUID,
    userId: dbSession.userId as UUID,
    accessTokenHash: dbSession.accessTokenHash,
    refreshTokenHash: dbSession.refreshTokenHash,
    accessTokenExpiresAt: dbSession.accessTokenExpiresAt,
    refreshTokenExpiresAt: dbSession.refreshTokenExpiresAt,
    status: statusMapToEnum[dbSession.status] ?? SessionStatusEnum.ACTIVE,
    ipAddress: dbSession.ipAddress ?? undefined,
    userAgent: dbSession.userAgent ?? undefined,
    createdAt: dbSession.createdAt,
    updatedAt: dbSession.updatedAt,
    deletedAt: dbSession.deletedAt ?? undefined,
  });
}

function mapEntityToDb(entity: SessionEntity): NewSession {
  return {
    id: entity.id,
    userId: entity.userId,
    accessTokenHash: entity.accessTokenHash,
    refreshTokenHash: entity.refreshTokenHash,
    accessTokenExpiresAt: entity.accessTokenExpiresAt,
    refreshTokenExpiresAt: entity.refreshTokenExpiresAt,
    status: statusMapToDb[entity.status] as any,
    ipAddress: entity.ipAddress ?? null,
    userAgent: entity.userAgent ?? null,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
    deletedAt: entity.deletedAt ?? null,
  };
}

@injectable()
export class DrizzleSessionRepository extends BaseDrizzleRepository implements ISessionRepository {
  protected table = sessions;

  constructor() {
    super();
  }

  async findById(id: UUID): Promise<SessionEntity | null> {
    const result = await super.findById(id) as Session | null;
    if (!result) return null;
    return mapDbToEntity(result);
  }

  async findAll(pagination?: PaginationParams): Promise<PaginatedResult<SessionEntity>> {
    const result = await super.findAll(pagination) as PaginatedResult<Session>;
    return { ...result, data: result.data.map(mapDbToEntity) };
  }

  async findByUserId(userId: UUID, pagination?: PaginationParams): Promise<PaginatedResult<SessionEntity>> {
    const result = await this.paginateWhere([eq(sessions.userId, userId)], pagination) as PaginatedResult<Session>;
    return { ...result, data: result.data.map(mapDbToEntity) };
  }

  async findByAccessTokenHash(accessTokenHash: string): Promise<SessionEntity | null> {
    const [result] = await this.db.select().from(sessions)
      .where(and(eq(sessions.accessTokenHash, accessTokenHash), isNull(sessions.deletedAt)))
      .limit(1) as Session[];
    if (!result) return null;
    return mapDbToEntity(result);
  }

  async findByRefreshTokenHash(refreshTokenHash: string): Promise<SessionEntity | null> {
    const [result] = await this.db.select().from(sessions)
      .where(and(eq(sessions.refreshTokenHash, refreshTokenHash), isNull(sessions.deletedAt)))
      .limit(1) as Session[];
    if (!result) return null;
    return mapDbToEntity(result);
  }

  async findActiveByUserId(userId: UUID): Promise<SessionEntity[]> {
    const results = await this.db.select().from(sessions)
      .where(and(eq(sessions.userId, userId), eq(sessions.status, 'active' as any), isNull(sessions.deletedAt)))
      .orderBy(desc(sessions.createdAt)) as Session[];
    return results.map(mapDbToEntity);
  }

  async revokeAllByUserId(userId: UUID): Promise<number> {
    const result = await this.db.update(sessions)
      .set({ status: 'revoked' as any, updatedAt: new Date() })
      .where(and(eq(sessions.userId, userId), eq(sessions.status, 'active' as any)));
    return (result as any).rowCount ?? 0;
  }

  async blacklistByAccessTokenHash(accessTokenHash: string): Promise<boolean> {
    const result = await this.db.update(sessions)
      .set({ status: 'blacklisted' as any, updatedAt: new Date() })
      .where(eq(sessions.accessTokenHash, accessTokenHash));
    return ((result as any).rowCount ?? 0) > 0;
  }

  async cleanupExpired(): Promise<number> {
    const result = await this.db.delete(sessions)
      .where(lt(sessions.accessTokenExpiresAt, new Date()));
    return (result as any).rowCount ?? 0;
  }

  async create(entity: SessionEntity): Promise<SessionEntity> {
    const dbSession = mapEntityToDb(entity) as any;
    await this.db.insert(sessions).values(dbSession);
    return entity;
  }

  async update(entity: SessionEntity): Promise<SessionEntity> {
    const dbSession = mapEntityToDb(entity);
    await this.db.update(sessions).set(dbSession).where(eq(sessions.id, dbSession.id!));
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
