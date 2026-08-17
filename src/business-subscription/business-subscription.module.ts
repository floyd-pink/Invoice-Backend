import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessSubscriptionController } from './business-subscription.controller';
import { BusinessSubscriptionService } from './business-subscription.service';
import { BusinessSubscriptionEntity } from './entities/business-subscription.entity';
import { BusinessEntity } from 'src/bussiness/entities/bussiness.entity';
import { PlanEntity } from 'src/plans/entities/plan.entity';
@Module({
  imports: [
    TypeOrmModule.forFeature([
      BusinessSubscriptionEntity,
      BusinessEntity,
      PlanEntity,
    ]),
  ],
  controllers: [BusinessSubscriptionController],
  providers: [BusinessSubscriptionService],
})
export class BusinessSubscriptionModule {}
