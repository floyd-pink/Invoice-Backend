import { BusinessService } from './bussiness.service';
import { BusinessEntity } from './entities/bussiness.entity';
import {
  BusinessSubscriptionEntity,
  SubscriptionStatus,
} from 'src/business-subscription/entities/business-subscription.entity';
import { UserEntity } from 'src/auth/entities/auth.entity';
import { PlanBillingCycle, PlanType } from 'src/plans/enum/plan-type.enum';

describe('BusinessService', () => {
  const freePlan = {
    id: 1,
    name: 'Free',
    type: PlanType.FREE,
    billingCycle: PlanBillingCycle.MONTHLY,
    isActive: true,
  };
  const user = { id: 7, role: 'user', freeBusinessCreated: false };
  const businessRepo = { findOne: jest.fn() };
  const subscriptionRepo = { findOne: jest.fn() };
  const manager = {
    findOne: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };
  const runner = {
    manager,
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
  };
  const redis = {
    getCachedFreePlan: jest.fn(),
    setCachedFreePlan: jest.fn(),
  };
  const service = new BusinessService(
    businessRepo as never,
    {} as never,
    {} as never,
    subscriptionRepo as never,
    { createQueryRunner: () => runner } as never,
    redis as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    user.freeBusinessCreated = false;
    redis.getCachedFreePlan.mockResolvedValue(freePlan);
    manager.count.mockResolvedValue(0);
    manager.findOne.mockImplementation(async (entity) =>
      entity === UserEntity ? user : null,
    );
    manager.create.mockImplementation((entity, value) =>
      entity === BusinessEntity
        ? { ...value, business_id: 'business-1' }
        : entity === BusinessSubscriptionEntity
          ? { ...value, subscriptionId: 1 }
          : value,
    );
    manager.save.mockImplementation(async (value) => value);
  });

  it('gives the first business one Free subscription', async () => {
    const result = await service.createBusiness(
      { name: 'Shop', panNumber: '123456789' },
      '7',
    );
    expect(result.requiresPayment).toBe(false);
    expect(result.subscription?.status).toBe(SubscriptionStatus.ACTIVE);
    expect(user.freeBusinessCreated).toBe(true);
    expect(manager.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: SubscriptionStatus.ACTIVE,
        planId: 1,
      }),
    );
    expect(runner.commitTransaction).toHaveBeenCalledTimes(1);
  });

  it('leaves an additional business restricted until its own payment succeeds', async () => {
    user.freeBusinessCreated = true;
    manager.count.mockResolvedValue(1);
    const result = await service.createBusiness(
      { name: 'Second Shop', panNumber: '987654321' },
      '7',
    );
    expect(result.requiresPayment).toBe(true);
    expect(result.subscription).toBeNull();
    expect(manager.save).toHaveBeenCalledWith(
      expect.objectContaining({
        isActive: false,
        requiresPaidSubscription: true,
      }),
    );
    expect(manager.save).not.toHaveBeenCalledWith(
      expect.objectContaining({
        status: SubscriptionStatus.ACTIVE,
      }),
    );
  });

  it('does not grant a second Free business when the owner has an older business', async () => {
    manager.count.mockResolvedValue(1);
    const result = await service.createBusiness(
      { name: 'Second Shop', panNumber: '987654321' },
      '7',
    );
    expect(result.requiresPayment).toBe(true);
  });

  it('returns the pending business when creation is retried after a lost response', async () => {
    user.freeBusinessCreated = true;
    manager.count.mockResolvedValue(1);
    manager.findOne.mockImplementation(async (entity) =>
      entity === UserEntity
        ? user
        : {
            business_id: 'business-1',
            business_name: 'Second Shop',
            panNumber: '987654321',
            owner: { id: 7 },
            requiresPaidSubscription: true,
            isActive: false,
          },
    );
    const result = await service.createBusiness(
      { name: 'Second Shop', panNumber: '987654321' },
      '7',
    );
    expect(result).toMatchObject({
      business_id: 'business-1',
      requiresPayment: true,
      subscription: null,
    });
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('denies a paid-only business after its subscription expires', async () => {
    businessRepo.findOne.mockResolvedValue({
      business_id: 'business-1',
      isActive: true,
      requiresPaidSubscription: true,
    });
    subscriptionRepo.findOne.mockResolvedValue({
      endsAt: new Date('2020-01-01'),
    });
    await expect(service.isMember('business-1', 7)).resolves.toBe(false);
  });
});
