import { Module } from '@nestjs/common';
import { BusinessController } from './bussiness.controller';
import { BusinessService } from './bussiness.service';
import { BusinessEntity } from './entities/bussiness.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from 'src/auth/entities/auth.entity';
import { BusinessSubscriptionEntity } from 'src/business-subscription/entities/business-subscription.entity';
import { PlanEntity } from 'src/plans/entities/plan.entity';
import { RedisModule } from 'src/common/redis/redis.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BusinessEntity,
      UserEntity,
      PlanEntity,
      BusinessSubscriptionEntity,
    ]),
    RedisModule,
  ],
  controllers: [BusinessController],
  providers: [BusinessService],
})
export class BusinessModule {}
