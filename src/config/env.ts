import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'qa', 'staging']).default('development'),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),

  DATABASE_URL: z.string().url(),
  DATABASE_POOL_SIZE: z.coerce.number().default(10),
  DATABASE_SSL: z.coerce.boolean().default(false),

  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.coerce.number().default(0),
  REDIS_TLS: z.coerce.boolean().default(false),

  JWT_PRIVATE_KEY: z.string().min(1),
  JWT_PUBLIC_KEY: z.string().min(1),
  JWT_ISSUER: z.string().default('cruz'),
  JWT_AUDIENCE: z.string().default('cruz-api'),

  TENANT_WEBHOOK_TIMEOUT_MS: z.coerce.number().default(10000),
  TENANT_WEBHOOK_MAX_RETRIES: z.coerce.number().default(3),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(1000),

  PINO_LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  PINO_LOG_FILE: z.string().default('./logs/cruz.log'),
  PINO_LOKI_HOST: z.string().optional(),
  PINO_LOKI_PORT: z.coerce.number().optional(),
  PINO_LOKI_USERNAME: z.string().optional(),
  PINO_LOKI_PASSWORD: z.string().optional(),

  OTEL_SERVICE_NAME: z.string().default('cruz'),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
  OTEL_EXPORTER_OTLP_HEADERS: z.string().optional(),

  PROMETHEUS_PORT: z.coerce.number().default(9090),
  PROMETHEUS_PATH: z.string().default('/metrics'),

  DOCKER_CONTAINER: z.coerce.boolean().default(false),
});

export type EnvConfig = z.infer<typeof envSchema>;

let config: EnvConfig | null = null;

export function getConfig(): EnvConfig {
  if (!config) {
    const result = envSchema.safeParse(process.env);
    if (!result.success) {
      console.error('Environment validation failed:', result.error.flatten().fieldErrors);
      throw new Error('Invalid environment configuration');
    }
    config = result.data;
  }
  return config;
}

export function resetConfig(): void {
  config = null;
}