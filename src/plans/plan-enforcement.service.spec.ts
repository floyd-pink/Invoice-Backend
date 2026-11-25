import { ForbiddenException } from '@nestjs/common';
import { PlanEnforcementService } from './plan-enforcement.service';
import { PlanFeature } from './enum/plan-feature.enum';

describe('PlanEnforcementService', () => {
  const subscriptions = { findOne: jest.fn() };
  const service = new PlanEnforcementService(
    {} as never,
    subscriptions as never,
    {} as never,
    {} as never,
  );

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-19T12:00:00.000Z'));
    jest.clearAllMocks();
  });
  afterEach(() => jest.useRealTimers());

  it('rejects an expired paid plan from the database', async () => {
    subscriptions.findOne.mockResolvedValue({
      endsAt: new Date('2026-11-18T12:00:00.000Z'),
      plan: {
        features: [{ feature: PlanFeature.Create_Quick_Sale, isEnabled: true }],
      },
    });
    await expect(
      service.checkPlanLimit('business-1', PlanFeature.Create_Quick_Sale),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(subscriptions.findOne).toHaveBeenCalledTimes(1);
  });
});
