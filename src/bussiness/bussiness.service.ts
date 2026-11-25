import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { BusinessEntity } from './entities/bussiness.entity';
import type { CreateBusinessDto } from './dto/bussiness.dto';
import { UserEntity } from 'src/auth/entities/auth.entity';
import { PlanEntity } from 'src/plans/entities/plan.entity';
import { BusinessSubscriptionEntity } from 'src/business-subscription/entities/business-subscription.entity';
import { SubscriptionStatus } from '../business-subscription/entities/business-subscription.entity';
import { PlanType } from 'src/plans/enum/plan-type.enum';
import { RedisService } from 'src/common/redis/redis.service';
@Injectable()
export class BusinessService {
  constructor(
    @InjectRepository(BusinessEntity)
    private readonly businessRepository: Repository<BusinessEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(PlanEntity)
    private readonly planRepository: Repository<PlanEntity>,
    @InjectRepository(BusinessSubscriptionEntity)
    private readonly subscriptionRepository: Repository<BusinessSubscriptionEntity>,
    private readonly dataSource: DataSource,
    private readonly redisService: RedisService,
  ) {}

  //answer if the business exists and the user is the owner of the business
  async isMember(businessId: string, userId: number): Promise<boolean> {
    const business = await this.businessRepository.findOne({
      where: {
        business_id: businessId,
        owner: { id: userId },
        isActive: true,
      },
    });
    if (!business) return false;
    if (!business.requiresPaidSubscription) return true;
    const subscription = await this.subscriptionRepository.findOne({
      where: { businessId, status: SubscriptionStatus.ACTIVE },
    });
    return !!subscription?.endsAt && subscription.endsAt > new Date();
  }
  async createBusiness(payload: CreateBusinessDto, userId: string) {
    const numericUserId = Number(userId);
    let freePlan = await this.redisService
      .getCachedFreePlan<PlanEntity | undefined>()
      .catch(() => undefined);

    if (!freePlan) {
      const dbPlan = await this.planRepository.findOne({
        where: { type: PlanType.FREE, isActive: true },
      });

      if (!dbPlan) {
        throw new NotFoundException('Free plan not found.');
      }
      freePlan = dbPlan;
      await this.redisService.setCachedFreePlan(freePlan).catch(() => {});
    }
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const user = await queryRunner.manager.findOne(UserEntity, {
        where: { id: numericUserId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!user) throw new NotFoundException('User not found');
      const businessCount = await queryRunner.manager.count(BusinessEntity, {
        where: { owner: { id: numericUserId } },
      });
      const getsFreePlan = !user.freeBusinessCreated && businessCount === 0;
      const existingBusiness = await queryRunner.manager.findOne(
        BusinessEntity,
        {
          where: { panNumber: payload.panNumber },
          relations: { owner: true },
        },
      );
      if (existingBusiness) {
        if (
          existingBusiness.owner.id === numericUserId &&
          existingBusiness.requiresPaidSubscription &&
          !existingBusiness.isActive
        ) {
          await queryRunner.commitTransaction();
          return {
            business_id: existingBusiness.business_id,
            Business_Name: existingBusiness.business_name,
            owner: existingBusiness.owner,
            panNumber: existingBusiness.panNumber,
            requiresPayment: true,
            subscription: null,
          };
        }
        throw new ConflictException('Business with this PAN already exists');
      }

      const business = queryRunner.manager.create(BusinessEntity, {
        business_name: payload.name,
        panNumber: payload.panNumber,
        owner: { id: numericUserId } as UserEntity,
        isActive: getsFreePlan,
        requiresPaidSubscription: !getsFreePlan,
      });

      const savedBusiness = await queryRunner.manager.save(business);

      user.role = 'admin';
      user.freeBusinessCreated = true;
      await queryRunner.manager.save(user);

      const now = new Date();

      const subscription = getsFreePlan
        ? queryRunner.manager.create(BusinessSubscriptionEntity, {
            business: savedBusiness,
            plan: freePlan,
            planId: freePlan.id,
            subscriptionType: freePlan.billingCycle,
            status: SubscriptionStatus.ACTIVE,
            startsAt: new Date(now),
            endsAt: null,
            nextBillingDate: null,
            lastBillingDate: null,
            nextPaymentAmount: null,
          })
        : null;

      if (subscription) await queryRunner.manager.save(subscription);

      await queryRunner.commitTransaction();

      return {
        business_id: savedBusiness.business_id,
        Business_Name: savedBusiness.business_name,
        owner: savedBusiness.owner,
        panNumber: savedBusiness.panNumber,
        requiresPayment: !getsFreePlan,
        subscription: subscription
          ? {
              subscriptionId: subscription.subscriptionId,
              planId: freePlan.id,
              planName: freePlan.name,
              billingCycle: freePlan.billingCycle,
              status: SubscriptionStatus.ACTIVE,
              startsAt: new Date(now),
              endsAt: null,
              nextBillingDate: null,
              lastBillingDate: null,
              nextPaymentAmount: null,
            }
          : null,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
