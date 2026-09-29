import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubscriptionPaymentsController } from './subscription-payments.controller';
import { SubscriptionPaymentsService } from './subscription-payments.service';
import { PaymentGatewayFactory } from './factories/payment-gateway.factory';
import { PaymentTransactionEntity } from './entities/payment-transaction.entity';
import { StripeGateway } from './gateways/stripe.gateway';
import { EsewaGateway } from './gateways/esewa.gateway';
import { PlanEntity } from 'src/plans/entities/plan.entity';
import { BusinessEntity } from 'src/bussiness/entities/bussiness.entity';
import { BusinessSubscriptionEntity } from 'src/business-subscription/entities/business-subscription.entity';
import { KhaltiGateway } from './gateways/khalti.gateway';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PaymentTransactionEntity,
      PlanEntity,
      BusinessEntity,
      BusinessSubscriptionEntity,
    ]),
  ],
  controllers: [SubscriptionPaymentsController],
  providers: [
    SubscriptionPaymentsService,
    PaymentGatewayFactory,
    StripeGateway,
    EsewaGateway,
    KhaltiGateway,
  ],
  exports: [SubscriptionPaymentsService],
})
export class SubscriptionPaymentsModule {}
