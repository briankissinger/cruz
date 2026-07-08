import { injectable, inject } from 'inversify';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, isNull, count, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { getDb } from '../connection.js';
import type { UUID } from '../../../core/domain/base.entity.js';
import type { PaginationParams, PaginatedResult, SortField } from '../../../core/interfaces/repository/index.js';
import { TYPES } from '../../config/inversify.config.js';
import { PaginationService } from '../pagination.service.js';

@injectable()
export abstract class BaseDrizzleRepository {
  protected abstract table: any;
  protected db!: NodePgDatabase;

  @inject(TYPES.PaginationService)
  protected paginationService: PaginationService = new PaginationService();

  constructor() {
    this.db = getDb();
  }

  async findById(id: UUID, includeDeleted = false): Promise<any> {
    const conditions: SQL[] = [eq(this.table.id, id)];
    if (!includeDeleted && this.table.deletedAt) {
      conditions.push(isNull(this.table.deletedAt));
    }
    const [result] = await this.db.select().from(this.table).where(and(...conditions)).limit(1);
    return result || null;
  }

  async findAll(pagination?: PaginationParams, includeDeleted = false): Promise<PaginatedResult<any>> {
    return this.paginate(pagination, includeDeleted);
  }

  async paginate(pagination?: PaginationParams, includeDeleted = false): Promise<PaginatedResult<any>> {
    return this.paginateWhere([], pagination, includeDeleted);
  }

  protected async paginateWhere(extraConditions: SQL[], pagination?: PaginationParams, includeDeleted = false): Promise<PaginatedResult<any>> {
    const strategy = pagination?.strategy ?? 'keyset';
    const limit = pagination?.limit ?? 20;
    const page = pagination?.page ?? 1;

    const conditions: SQL[] = [...extraConditions];
    if (!includeDeleted && this.table.deletedAt) {
      conditions.push(isNull(this.table.deletedAt));
    }
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Resolve order by (Approach 2 composite order by columns for stable seek)
    const orderBy: SortField[] = pagination?.orderBy ?? [
      { column: 'createdAt', direction: 'desc' },
      { column: 'id', direction: 'desc' }
    ];

    let total = 0;
    const withTotal = pagination?.withTotal ?? (strategy !== 'keyset');
    if (withTotal) {
      const [{ count: totalCount }] = await this.db.select({ count: count() }).from(this.table).where(whereClause) as any;
      total = Number(totalCount);
    }

    switch (strategy) {
      case 'offset': {
        const orderSQL = this.paginationService.buildOrderBy(orderBy, this.table);
        const data = await this.db.select().from(this.table)
          .where(whereClause)
          .orderBy(...orderSQL)
          .limit(limit)
          .offset((page - 1) * limit);

        const totalPages = Math.ceil(total / limit);
        return {
          data,
          total,
          page,
          limit,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        };
      }

      case 'keyset': {
        const after = pagination?.after;
        const before = pagination?.before;
        const isForward = !before;

        let cursor: Record<string, unknown> | undefined;
        if (after) {
          cursor = this.paginationService.decodeCursor(after);
        } else if (before) {
          cursor = this.paginationService.decodeCursor(before);
        }

        const keysetWhere = cursor
          ? this.paginationService.buildKeysetCondition(cursor, orderBy, this.table, isForward)
          : undefined;

        const finalWhere = keysetWhere
          ? (whereClause ? and(whereClause, keysetWhere) : keysetWhere)
          : whereClause;

        const effectiveOrderBy: SortField[] = isForward ? orderBy : orderBy.map((o): SortField => ({
          column: o.column,
          direction: o.direction === 'asc' ? 'desc' : 'asc'
        }));

        const orderSQL = this.paginationService.buildOrderBy(effectiveOrderBy, this.table);

        let data = await this.db.select().from(this.table)
          .where(finalWhere)
          .orderBy(...orderSQL)
          .limit(limit + 1);

        const hasMore = data.length > limit;
        if (hasMore) {
          data = data.slice(0, limit);
        }

        if (!isForward) {
          data.reverse();
        }

        const hasNextPage = isForward ? hasMore : !!before;
        const hasPrevPage = isForward ? !!after : hasMore;

        let nextCursor: string | undefined;
        let prevCursor: string | undefined;

        if (data.length > 0) {
          const firstItem = data[0];
          const lastItem = data[data.length - 1];

          const firstCursorObj = this.paginationService.getCursorValue(firstItem, orderBy);
          const lastCursorObj = this.paginationService.getCursorValue(lastItem, orderBy);

          nextCursor = this.paginationService.encodeCursor(lastCursorObj);
          prevCursor = this.paginationService.encodeCursor(firstCursorObj);
        }

        return {
          data,
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          nextCursor: hasNextPage ? nextCursor : undefined,
          prevCursor: hasPrevPage ? prevCursor : undefined,
          hasNextPage,
          hasPrevPage,
        };
      }

      case 'ntile': {
        const totalPages = pagination?.totalPages ?? 10;
        const ntileSql = this.paginationService.buildNtileSubquery(this.table, whereClause, orderBy, totalPages);

        const rawData = await this.db.execute(sql`
          SELECT * FROM ${ntileSql} AS sub
          WHERE sub.__page = ${page}
          LIMIT ${limit}
        `);

        const data = this.paginationService.normalizeRows(rawData.rows as any[]) as any[];

        return {
          data,
          total,
          page,
          limit,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        };
      }

      case 'bucket': {
        const bucketColumn = pagination?.bucketColumn ?? 'id';
        const numBuckets = pagination?.numBuckets ?? 10;
        const bucketIndex = page - 1;

        const bucketCondition = this.paginationService.buildBucketCondition(bucketColumn, numBuckets, bucketIndex, this.table);
        const finalWhere = whereClause ? and(whereClause, bucketCondition) : bucketCondition;

        const orderSQL = this.paginationService.buildOrderBy(orderBy, this.table);

        const data = await this.db.select().from(this.table)
          .where(finalWhere)
          .orderBy(...orderSQL)
          .limit(limit);

        return {
          data,
          total,
          page,
          limit,
          totalPages: numBuckets,
          hasNextPage: page < numBuckets,
          hasPrevPage: page > 1,
        };
      }

      default:
        throw new Error(`Unsupported pagination strategy: ${strategy}`);
    }
  }

  async create(entity: any): Promise<any> {
    await this.db.insert(this.table).values(entity);
    return entity;
  }

  async update(entity: any): Promise<any> {
    await this.db.update(this.table).set(entity).where(eq(this.table.id, entity.id));
    return entity;
  }

  async delete(id: UUID): Promise<boolean> {
    const result = await this.db.delete(this.table).where(eq(this.table.id, id));
    return (result as any).rowCount > 0;
  }

  async softDelete(id: UUID): Promise<boolean> {
    const result = await this.db.update(this.table)
      .set({ deletedAt: new Date(), updatedAt: new Date() } as any)
      .where(eq(this.table.id, id));
    return (result as any).rowCount > 0;
  }

  async restore(id: UUID): Promise<boolean> {
    const result = await this.db.update(this.table)
      .set({ deletedAt: null, updatedAt: new Date() } as any)
      .where(eq(this.table.id, id));
    return (result as any).rowCount > 0;
  }
}
