import { ForbiddenException } from '@nestjs/common';
import { PlanEnforcementService } from './plan-enforcement.service';
import { PlanFeature } from './enum/plan-feature.enum';

describe('PlanEnforcementService.checkPlanLimit', () => {
  const subscriptionRepository = { findOne: jest.fn() };
  const redisService = {
    getCachedSubscription: jest.fn(),
    setCachedSubscription: jest.fn(),
  };
  const service = new PlanEnforcementService(
    {} as never,
    subscriptionRepository as never,
    {} as never,
    {} as never,
    redisService as never,
  );

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-19T12:00:00.000Z'));
    jest.clearAllMocks();
  });

  afterEach(() => jest.useRealTimers());

  it('reloads cache entries without an expiry date', async () => {
    redisService.getCachedSubscription.mockResolvedValue({
      planId: 1,
      planType: 'FREE',
      features: [],
    });
    subscriptionRepository.findOne.mockResolvedValue({
      planId: 1,
      endsAt: new Date('2026-11-18T12:00:00.000Z'),
      plan: { type: 'FREE', features: [] },
    });

    await expect(
      service.checkPlanLimit('business-1', PlanFeature.Create_Quick_Sale),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(subscriptionRepository.findOne).toHaveBeenCalledTimes(1);
    expect(redisService.setCachedSubscription).toHaveBeenCalledWith(
      'business-1',
      expect.objectContaining({
        expiresAt: new Date('2026-11-18T12:00:00.000Z'),
      }),
    );
  });
});
