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

  async createBusiness(payload: CreateBusinessDto, userId: string) {
    const numericUserId = Number(userId);
    let freePlan = await this.redisService.getCachedFreePlan<
      PlanEntity | undefined
    >();

    if (!freePlan) {
      const dbPlan = await this.planRepository.findOne({
        where: { type: PlanType.FREE, isActive: true },
      });

      if (!dbPlan) {
        throw new NotFoundException('Free plan not found.');
      }
      freePlan = dbPlan;
      await this.redisService.setCachedFreePlan(freePlan);
    }
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const existingBusiness = await queryRunner.manager.findOne(
        BusinessEntity,
        {
          where: { panNumber: payload.panNumber },
        },
      );
      if (existingBusiness) {
        throw new ConflictException('Business with this PAN already exists');
      }

      const business = queryRunner.manager.create(BusinessEntity, {
        business_name: payload.name,
        panNumber: payload.panNumber,
        owner: { id: numericUserId } as UserEntity,
      });

      const savedBusiness = await queryRunner.manager.save(business);

      const user = await queryRunner.manager.findOne(UserEntity, {
        where: { id: numericUserId },
      });
      if (user) {
        user.role = 'admin';
        await queryRunner.manager.save(user);
      }

      const now = new Date();

      const subscription = queryRunner.manager.create(
        BusinessSubscriptionEntity,
        {
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
        },
      );

      await queryRunner.manager.save(subscription);

      await queryRunner.commitTransaction();

      return {
        business_id: savedBusiness.business_id,
        Business_Name: savedBusiness.business_name,
        owner: savedBusiness.owner,
        panNumber: savedBusiness.panNumber,
        subscription: {
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
        },
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
