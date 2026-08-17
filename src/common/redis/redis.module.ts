import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Redis } from '@upstash/redis';
import { RedisService } from './redis.service';

@Module({
  imports: [
    CacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redis = new Redis({
          url: configService.get<string>('REDIS_URL'),
          token: configService.get<string>('REDIS_TOKEN'),
        });

        return {
          store: {
            get: (key: string) => redis.get(key),
            set: (key: string, value: any, ttl?: number) =>
              redis.set(key, value, ttl ? { ex: ttl } : undefined),
            del: (key: string) => redis.del(key),
            reset: () => redis.flushdb(),
          },
          ttl: 3600,
        };
      },
    }),
  ],
  providers: [RedisService],
  exports: [RedisService, CacheModule],
})
export class RedisModule {}
