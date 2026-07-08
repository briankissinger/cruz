import { injectable } from 'inversify';
import { sql, type SQL } from 'drizzle-orm';
import type { SortField } from '../../core/interfaces/repository/index.js';

@injectable()
export class PaginationService {
  /**
   * Encodes pagination values into an opaque base64url cursor.
   */
  encodeCursor(values: Record<string, unknown>): string {
    return Buffer.from(JSON.stringify(values), 'utf-8').toString('base64url');
  }

  /**
   * Decodes an opaque base64url cursor back into sorting values.
   */
  decodeCursor(cursor: string): Record<string, unknown> {
    try {
      return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf-8'));
    } catch (err) {
      throw new Error('Invalid pagination cursor');
    }
  }

  /**
   * Maps SortFields to standard Drizzle SQL orderBy expressions.
   */
  buildOrderBy(orderBy: SortField[], table: any): SQL[] {
    return orderBy.map(({ column, direction }) => {
      const col = table[column];
      if (!col) {
        throw new Error(`Column ${column} does not exist on table ${table[Symbol.for('drizzle:Name')] || 'unknown'}`);
      }
      return direction === 'asc' ? sql`${col} ASC` : sql`${col} DESC`;
    });
  }

  /**
   * Implements recursive multi-column Seek Method (Approach 2)
   * This elegantly handles mixed ASC/DESC sorting directions.
   */
  buildSeekCondition(
    cols: any[],
    vals: any[],
    directions: ('asc' | 'desc')[],
    isForward: boolean,
    index = 0
  ): SQL | undefined {
    if (index >= cols.length) return undefined;

    const col = cols[index];
    const val = vals[index];
    const dir = directions[index];

    // Determine the comparison operator based on sort direction and page direction (forward/backward)
    // Forward + ASC => col > val
    // Forward + DESC => col < val
    // Backward + ASC => col < val
    // Backward + DESC => col > val
    const isGreaterThan = (isForward && dir === 'asc') || (!isForward && dir === 'desc');
    const compOp = isGreaterThan ? sql`>` : sql`<`;

    const currentComp = sql`${col} ${compOp} ${val}`;

    if (index === cols.length - 1) {
      return currentComp;
    }

    const nextComp = this.buildSeekCondition(cols, vals, directions, isForward, index + 1);
    if (!nextComp) return currentComp;

    // Recursive SQL formulation: (C1 > V1) OR (C1 = V1 AND (C2 > V2 OR ...))
    return sql`(${currentComp} OR (${col} = ${val} AND ${nextComp}))`;
  }

  /**
   * Builds the Keyset WHERE clause (Seek Method) from sorting definitions and cursor.
   */
  buildKeysetCondition(
    cursor: Record<string, unknown>,
    orderBy: SortField[],
    table: any,
    isForward: boolean
  ): SQL | undefined {
    const cols: any[] = [];
    const vals: any[] = [];
    const directions: ('asc' | 'desc')[] = [];

    for (const { column, direction } of orderBy) {
      const col = table[column];
      const val = cursor[column];
      if (col && val !== undefined) {
        cols.push(col);
        vals.push(val);
        directions.push(direction);
      }
    }

    if (cols.length === 0) return undefined;
    return this.buildSeekCondition(cols, vals, directions, isForward);
  }

  /**
   * Builds subquery for Ntile (Approach 4) window function.
   * Partitions entire dataset into totalPages number of buckets, then lets us select from it.
   */
  buildNtileSubquery(
    table: any,
    whereClause: SQL | undefined,
    orderBy: SortField[],
    totalPages: number
  ): SQL {
    const tableIdentifier = table;
    const orderBySql = orderBy.map(({ column, direction }) => {
      const col = table[column];
      return direction === 'asc' ? sql`${col} ASC` : sql`${col} DESC`;
    });

    return sql`
      (SELECT *, NTILE(${totalPages}) OVER (ORDER BY ${sql.join(orderBySql, sql`, `)}) AS __page
       FROM ${tableIdentifier}
       ${whereClause ? sql`WHERE ${whereClause}` : sql``})
    `;
  }

  /**
   * Builds condition for Bucket Pagination (Approach 5)
   * Splits table records into uniform buckets using high-performance modulo of database-level UUID hashing.
   */
  buildBucketCondition(
    bucketColumn: string,
    numBuckets: number,
    bucketIndex: number,
    table: any
  ): SQL {
    const col = table[bucketColumn];
    if (!col) {
      throw new Error(`Bucket column ${bucketColumn} not found on table`);
    }

    // High performance uniform distribution using hashtext() modulo
    return sql`abs(hashtext(${col}::text)) % ${numBuckets} = ${bucketIndex}`;
  }

  /**
   * Extract cursor values from a record row based on the sort fields.
   */
  getCursorValue(row: any, orderBy: SortField[]): Record<string, unknown> {
    const cursor: Record<string, unknown> = {};
    for (const { column } of orderBy) {
      cursor[column] = row[column];
    }
    return cursor;
  }

  /**
   * Raw SQL paths return snake_case DB field names; repositories expect Drizzle's camelCase row shape.
   */
  normalizeRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
    return rows.map((row) => {
      const normalized: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(row)) {
        if (key === '__page') continue;
        normalized[this.toCamelCase(key)] = value;
      }

      return normalized;
    });
  }

  private toCamelCase(value: string): string {
    return value.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
  }
}
