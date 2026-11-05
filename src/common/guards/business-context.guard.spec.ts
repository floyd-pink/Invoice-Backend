import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { BusinessService } from 'src/bussiness/bussiness.service';
import { RedisService } from '../redis/redis.service';
import { BusinessContextGuard } from './business-context.guard';

describe('BusinessContextGuard', () => {
  const businessId = 'business-1';
  let guard: BusinessContextGuard;
  let reflector: { getAllAndOverride: jest.Mock };
  let businessService: { isMember: jest.Mock };
  let redisService: { get: jest.Mock; set: jest.Mock };

  function context(user?: { sub: number; businessId?: string }) {
    const request: { user?: typeof user; businessId?: string } = { user };
    const executionContext = {
      getHandler: () => context,
      getClass: () => BusinessContextGuard,
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    return { request, executionContext };
  }

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) };
    businessService = { isMember: jest.fn().mockResolvedValue(true) };
    redisService = {
      get: jest.fn().mockResolvedValue(undefined),
      set: jest.fn().mockResolvedValue(undefined),
    };
    guard = new BusinessContextGuard(
      reflector as unknown as Reflector,
      businessService as unknown as BusinessService,
      redisService as unknown as RedisService,
    );
  });

  it('allows a route marked to skip business context without a business token', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    const { executionContext } = context();

    await expect(guard.canActivate(executionContext)).resolves.toBe(true);
    expect(businessService.isMember).not.toHaveBeenCalled();
  });

  it('rejects a business route when the token has no selected business', async () => {
    const { executionContext } = context({ sub: 1 });

    await expect(guard.canActivate(executionContext)).rejects.toThrow(
      new ForbiddenException('Business Id not found'),
    );
  });

  it('checks ownership and attaches the business on a cache miss', async () => {
    const { request, executionContext } = context({ sub: 1, businessId });

    await expect(guard.canActivate(executionContext)).resolves.toBe(true);
    expect(businessService.isMember).toHaveBeenCalledWith(businessId, 1);
    expect(request.businessId).toBe(businessId);
  });

  it('checks ownership when the cache read fails', async () => {
    redisService.get.mockRejectedValue(new Error('Cache unavailable'));
    const { request, executionContext } = context({ sub: 1, businessId });

    await expect(guard.canActivate(executionContext)).resolves.toBe(true);
    expect(businessService.isMember).toHaveBeenCalledWith(businessId, 1);
    expect(request.businessId).toBe(businessId);
  });

  it('rejects a selected business that the user does not own', async () => {
    businessService.isMember.mockResolvedValue(false);
    const { executionContext } = context({ sub: 1, businessId });

    await expect(guard.canActivate(executionContext)).rejects.toThrow(
      new ForbiddenException('Business not accessible'),
    );
  });
});
