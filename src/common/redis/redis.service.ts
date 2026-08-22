import { PlanFeature, LimitPeriod } from './../../plans/enum/plan-feature.enum';
import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

export const CACHE_KEYS = {
  FREE_PLAN: 'plan:free',
  SUBSCRIPTION: (businessId: string) => `subscription:${businessId}`,
} as const;

export const CACHE_TTL = {
  FREE_PLAN: 60 * 60 * 24,
  SUBSCRIPTION: 60 * 60 * 24,
} as const;

@Injectable()
export class RedisService {
  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  async get<T>(key: string): Promise<T | undefined> {
    return this.cache.get<T>(key);
  }
  async getCachedSubscription(businessId: string) {
    return this.get<{
      planId: number;
      planType: string;
      features: Array<{
        feature: PlanFeature;
        limit: number | null;
        isEnabled: boolean;
        limitPeriod: LimitPeriod;
      }>;
    }>(CACHE_KEYS.SUBSCRIPTION(businessId));
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

  async setCachedSubscription(
    businessId: string,
    data: unknown,
  ): Promise<void> {
    await this.set(
      CACHE_KEYS.SUBSCRIPTION(businessId),
      data,
      CACHE_TTL.SUBSCRIPTION,
    );
  }

  async invalidateFreePlan(): Promise<void> {
    await this.del(CACHE_KEYS.FREE_PLAN);
  }
  async invalidateSubscription(businessId: string): Promise<void> {
    await this.del(CACHE_KEYS.SUBSCRIPTION(businessId));
  }
}
