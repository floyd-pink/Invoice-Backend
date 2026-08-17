import { IsEnum, IsNumber, IsOptional, IsUUID, Min } from 'class-validator';
import { PlanBillingCycle } from 'src/plans/enum/plan-type.enum';
import { SubscriptionStatus } from '../entities/business-subscription.entity';

export class createBusinessSubscriptionDto {
  @IsUUID()
  businessId: string;
  @IsNumber()
  planId: string;

  @IsEnum(PlanBillingCycle, {
    message: 'subscriptionType must be a valid PlanBillingCycle',
  })
  subscriptionType: PlanBillingCycle;
  @IsEnum(SubscriptionStatus, {
    message: 'status must be a valid SubscriptionStatus',
  })
  status: SubscriptionStatus;

  @IsOptional()
  @IsNumber()
  @Min(0)
  nextPaymentAmount?: number;
}
