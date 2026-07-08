import { injectable } from 'inversify';
import { createClient, type RedisClientType } from 'redis';
import { getConfig } from '../../config/env.js';

export interface IRedisBlacklistService {
  blacklistToken(jti: string, expiresInSeconds: number): Promise<void>;
  isTokenBlacklisted(jti: string): Promise<boolean>;
  blacklistApiKey(apiKeyHash: string): Promise<void>;
  isApiKeyBlacklisted(apiKeyHash: string): Promise<boolean>;
  removeBlacklistedApiKey(apiKeyHash: string): Promise<void>;
  disconnect(): Promise<void>;
}

@injectable()
export class RedisBlacklistService implements IRedisBlacklistService {
  private client: RedisClientType;

  constructor() {
    const config = getConfig();
    this.client = createClient({
      socket: {
        host: config.REDIS_HOST,
        port: config.REDIS_PORT,
        ...(config.REDIS_TLS ? { tls: true as const } : {}),
      } as any,
      password: config.REDIS_PASSWORD || undefined,
      database: config.REDIS_DB,
    });
    this.client.connect().catch((err) => {
      console.error('redis connection failed:', err);
    });
  }

  async blacklistToken(jti: string, expiresInSeconds: number): Promise<void> {
    await this.client.set(`blacklist:token:${jti}`, '1', { EX: expiresInSeconds });
  }

  async isTokenBlacklisted(jti: string): Promise<boolean> {
    const result = await this.client.get(`blacklist:token:${jti}`);
    return result !== null;
  }

  async blacklistApiKey(apiKeyHash: string): Promise<void> {
    await this.client.set(`blacklist:apikey:${apiKeyHash}`, '1');
  }

  async isApiKeyBlacklisted(apiKeyHash: string): Promise<boolean> {
    const result = await this.client.get(`blacklist:apikey:${apiKeyHash}`);
    return result !== null;
  }

  async removeBlacklistedApiKey(apiKeyHash: string): Promise<void> {
    await this.client.del(`blacklist:apikey:${apiKeyHash}`);
  }

  async disconnect(): Promise<void> {
    await this.client.quit();
  }
}