import { PlansService } from './plans.service';
import { PlanType } from './enum/plan-type.enum';

describe('PlansService', () => {
  it('invalidates the cached Free plan when its configuration changes', async () => {
    const plan = { id: 1, type: PlanType.FREE, name: 'Free' };
    const plans = {
      findOne: jest.fn().mockResolvedValue(plan),
      save: jest.fn(async (value) => value),
    };
    const redis = {
      invalidateFreePlan: jest.fn().mockResolvedValue(undefined),
    };
    const service = new PlansService(
      plans as never,
      {} as never,
      redis as never,
    );
    await service.update(1, { name: 'Starter' });
    expect(plans.save).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Starter' }),
    );
    expect(redis.invalidateFreePlan).toHaveBeenCalledTimes(1);
  });
});
