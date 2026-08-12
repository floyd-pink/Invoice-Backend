//here I have define the initial rules
import { PlanFeature, LimitPeriod } from '../enum/plan-feature.enum';
import { PlanPrice, PlanType } from '../enum/plan-type.enum';
export const DEFAULT_PLAN_CONFIGS = [
  {
    type: PlanType.FREE,
    name: 'Free',
    price: PlanPrice.FREE,

    features: [
      {
        feature: PlanFeature.Create_Invoice,
        limit: 100,
        period: LimitPeriod.MONTHLY,
      },
      {
        feature: PlanFeature.Create_Customer,
        limit: 10,
        period: LimitPeriod.MONTHLY,
      },
    ],
  },

  {
    type: PlanType.PRO,
    name: 'Pro',
    price: PlanPrice.PRO,

    features: [
      {
        feature: PlanFeature.Create_Invoice,
        limit: 500,
        period: LimitPeriod.MONTHLY,
      },
      {
        feature: PlanFeature.Create_Customer,
        limit: 100,
        period: LimitPeriod.MONTHLY,
      },
    ],
  },

  {
    type: PlanType.ENTERPRISE,
    name: 'Enterprise',
    price: PlanPrice.ENTERPRISE,

    features: [
      {
        feature: PlanFeature.Create_Invoice,
        limit: null,
        period: LimitPeriod.NONE,
      },
      {
        feature: PlanFeature.Create_Customer,
        limit: null,
        period: LimitPeriod.NONE,
      },
    ],
  },
];