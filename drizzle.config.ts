import { defineConfig } from 'drizzle-kit';
import { getConfig } from './src/config/env.js';

const config = getConfig();

export default defineConfig({
  schema: './src/infra/database/models/schema.ts',
  out: './src/infra/database/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: config.DATABASE_URL,
  },
  verbose: true,
  strict: true,
});