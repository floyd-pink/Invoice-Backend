import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RedisModule } from 'src/common/redis/redis.module';
import { PlanEnforcementService } from './plan-enforcement.service';
import { InvoiceEntity } from 'src/invoice_items/entities/invoice.entity';
import { BusinessSubscriptionEntity } from './../business-subscription/entities/business-subscription.entity';
import { BusinessCustomer } from 'src/business-customer/entities/business-customer.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InvoiceEntity,
      BusinessSubscriptionEntity,
      BusinessCustomer,
    ]),
    RedisModule,
  ],
  providers: [PlanEnforcementService],
  exports: [PlanEnforcementService],
})
export class PlanEnforcementModule {}
