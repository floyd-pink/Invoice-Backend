import { IsEnum, IsNumber, IsOptional, IsUUID, Min } from 'class-validator';
import { PlanBillingCycle } from 'src/plans/enum/plan-type.enum';
import { SubscriptionStatus } from '../entities/business-subscription.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBusinessSubscriptionDto {
  @ApiProperty({ example: 'uuid-of-business', description: 'Business UUID' })
  @IsUUID()
  businessId: string;

  @ApiProperty({ example: 1, description: 'Plan ID' })
  @IsNumber()
  planId: string;

  @ApiProperty({
    enum: PlanBillingCycle,
    example: PlanBillingCycle.MONTHLY,
    description: 'Subscription billing cycle',
  })
  @IsEnum(PlanBillingCycle, {
    message: 'subscriptionType must be a valid PlanBillingCycle',
  })
  subscriptionType: PlanBillingCycle;

  @ApiProperty({
    enum: SubscriptionStatus,
    example: SubscriptionStatus.ACTIVE,
    description: 'Subscription status',
  })
  @IsEnum(SubscriptionStatus, {
    message: 'status must be a valid SubscriptionStatus',
  })
  status: SubscriptionStatus;

  @ApiPropertyOptional({ example: 1000.00, description: 'Next payment amount' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  nextPaymentAmount?: number;
}
