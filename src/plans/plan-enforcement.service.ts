import { RedisService } from 'src/common/redis/redis.service';
import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';

import {
  BusinessSubscriptionEntity,
  SubscriptionStatus,
} from './../business-subscription/entities/business-subscription.entity';

import { InvoiceEntity } from 'src/invoice_items/entities/invoice.entity';
import { BusinessCustomer } from 'src/business-customer/entities/business-customer.entity';

import { LimitPeriod, PlanFeature } from './enum/plan-feature.enum';

@Injectable()
export class PlanEnforcementService {
  constructor(
    @InjectRepository(InvoiceEntity)
    private readonly invoiceRepository: Repository<InvoiceEntity>,

    @InjectRepository(BusinessSubscriptionEntity)
    private readonly subscriptionRepository: Repository<BusinessSubscriptionEntity>,

    @InjectRepository(BusinessCustomer)
    private readonly businessCustomerRepository: Repository<BusinessCustomer>,

    private readonly redisService: RedisService,
  ) {}

  async checkPlanLimit(
    businessId: string,
    feature: PlanFeature,
  ): Promise<void> {
    // 1. Trying  Redis first
    let planData = await this.redisService.getCachedSubscription(businessId);

    // 2. Cache miss -> fetch from database
    if (!planData) {
      const subscription = await this.subscriptionRepository.findOne({
        where: {
          businessId,
          status: SubscriptionStatus.ACTIVE,
        },
        relations: {
          plan: {
            features: true,
          },
        },
      });

      // No active subscription
      if (!subscription || !subscription.plan) {
        throw new ForbiddenException('No active subscription plan found.');
      }
      //format to store in redis
      planData = {
        planId: subscription.planId,
        planType: subscription.plan.type,
        features: subscription.plan.features.map((f) => ({
          feature: f.feature,
          limit: f.limit,
          limitPeriod: f.limitPeriod,
          isEnabled: f.isEnabled,
        })),
      };

      // Save to Redis
      await this.redisService.setCachedSubscription(businessId, planData);
    }

    // 3. Find requested feature
    const planFeature = planData.features.find((f) => f.feature === feature);

    // Feature doesn't exist or is disabled
    if (!planFeature || !planFeature.isEnabled) {
      throw new ForbiddenException(
        `Your plan does not include access to ${feature}.`,
      );
    }

    // 4. null limit = unlimited
    if (planFeature.limit === null || planFeature.limit === undefined) {
      return;
    }

    // 5. Count current usage
    const usageCount = await this.countUsage(
      businessId,
      feature,
      planFeature.limitPeriod,
    );

    // 6. Enforce limit
    if (usageCount >= planFeature.limit) {
      throw new ForbiddenException(
        `You have reached your limit of ${planFeature.limit} for ${feature} (${planFeature.limitPeriod}).`,
      );
    }

    // 7. User is allowed to continue
  }

  private async countUsage(
    businessId: string,
    feature: PlanFeature,
    period: LimitPeriod,
  ): Promise<number> {
    const startDate = this.getStartDateForPeriod(period);

    switch (feature) {
      case PlanFeature.Create_Invoice:
        return this.invoiceRepository.count({
          where: {
            businessId,
            ...(startDate ? { createdAt: MoreThanOrEqual(startDate) } : {}),
          },
        });

      case PlanFeature.Create_Customer:
        return this.businessCustomerRepository.count({
          where: {
            businessId,
            ...(startDate ? { associatedAt: MoreThanOrEqual(startDate) } : {}),
          },
        });

      default:
        return 0;
    }
  }

  private getStartDateForPeriod(period: LimitPeriod): Date | null {
    const now = new Date();

    switch (period) {
      case LimitPeriod.MONTHLY:
        return new Date(now.getFullYear(), now.getMonth(), 1);

      case LimitPeriod.YEARLY:
        return new Date(now.getFullYear(), 0, 1);

      case LimitPeriod.NONE:
      default:
        return null;
    }
  }
}
