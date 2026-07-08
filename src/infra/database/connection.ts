import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool, type PoolConfig } from 'pg';
import * as schema from './models/schema.js';
import { getConfig } from '../../config/env.js';

let pool: Pool | null = null;
let db: NodePgDatabase | null = null;

export function getPool(): Pool {
  if (!pool) {
    const config = getConfig();
    const poolConfig: PoolConfig = {
      connectionString: config.DATABASE_URL,
      max: config.DATABASE_POOL_SIZE,
      ssl: config.DATABASE_SSL ? { rejectUnauthorized: false } : false,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    };
    pool = new Pool(poolConfig);

    pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
    });
  }
  return pool;
}

export function getDb(): NodePgDatabase {
  if (!db) {
    db = drizzle({ client: getPool(), logger: true }) as NodePgDatabase;
  }
  return db;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    db = null;
  }
}

export async function healthCheck(): Promise<boolean> {
  try {
    const client = await getPool().connect();
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch {
    return false;
  }
}

export { schema };
export type { NodePgDatabase } from 'drizzle-orm/node-postgres';
export type { Pool } from 'pg';