import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

export const CACHE_KEYS = {
  FREE_PLAN: 'plan:free',
} as const;

export const CACHE_TTL = {
  FREE_PLAN: 60 * 60 * 24,
} as const;

@Injectable()
export class RedisService {
  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  async get<T>(key: string): Promise<T | undefined> {
    return this.cache.get<T>(key);
  }

  async set(key: string, value: unknown, ttl?: number): Promise<void> {
    await this.cache.set(key, value, ttl);
  }

  async del(key: string): Promise<void> {
    await this.cache.del(key);
  }

  async delMany(keys: string[]): Promise<void> {
    await Promise.all(keys.map((k) => this.cache.del(k)));
  }

  async getCachedFreePlan<T>() {
    return this.get<T>(CACHE_KEYS.FREE_PLAN);
  }

  async setCachedFreePlan(plan: unknown): Promise<void> {
    await this.set(CACHE_KEYS.FREE_PLAN, plan, CACHE_TTL.FREE_PLAN);
  }

  async invalidateFreePlan(): Promise<void> {
    await this.del(CACHE_KEYS.FREE_PLAN);
  }
}
