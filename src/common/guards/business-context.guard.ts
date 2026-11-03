import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { BusinessService } from 'src/bussiness/bussiness.service';
import { RedisService } from '../redis/redis.service';
import { SKIP_BUSINESS_KEY } from '../decorators/skip-business-context.decorator';

@Injectable()
export class BusinessContextGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly businessService: BusinessService,
    private readonly redisService: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isSkip = this.reflector.getAllAndOverride<boolean>(
      SKIP_BUSINESS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isSkip) return true;

    const req = context.switchToHttp().getRequest();
    const user = req.user;
    const userId = Number(user?.sub ?? user?.id);
    if (!Number.isInteger(userId) || userId <= 0) {
      throw new ForbiddenException('User not found in request');
    }

    const candidate = user.businessId;
    if (!candidate) throw new ForbiddenException('Business Id not found');

    // 1. Check cached membership (user-scoped)
    const cacheKey = `user:${userId}:business:${candidate}`;
    const cached = await this.redisService
      .get<string>(cacheKey)
      .catch(() => undefined);
    if (cached === '1') {
      req.businessId = candidate;
      return true;
    }
    const allowed = await this.businessService.isMember(candidate, userId);
    if (!allowed) throw new ForbiddenException('Business not accessible');
    await this.redisService.set(cacheKey, '1', 300).catch(() => {});
    req.businessId = candidate;
    return true;
  }
}
