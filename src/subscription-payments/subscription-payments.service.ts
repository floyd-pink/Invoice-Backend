import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Not, Repository } from 'typeorm';
import { BusinessEntity } from 'src/bussiness/entities/bussiness.entity';
import {
  BusinessSubscriptionEntity,
  SubscriptionStatus,
} from 'src/business-subscription/entities/business-subscription.entity';
import { RedisService } from 'src/common/redis/redis.service';
import { PlanEntity } from 'src/plans/entities/plan.entity';
import { PlanBillingCycle, PlanType } from 'src/plans/enum/plan-type.enum';
import { InitiateSubscriptionPaymentDto } from './dto/subscription-payments.dto';
import {
  PaymentTransactionEntity,
  TransactionStatus,
} from './entities/payment-transaction.entity';
import { PaymentProvider } from './enums/payment-provider.enum';
import { PaymentGatewayFactory } from './factories/payment-gateway.factory';
import { PaymentRequest, PaymentResponse, PaymentStatus } from './interfaces';

/** A payment attempt belongs to one owner, one business, and one plan. */
@Injectable()
export class SubscriptionPaymentsService {
  constructor(
    @InjectRepository(PaymentTransactionEntity)
    private readonly transactions: Repository<PaymentTransactionEntity>,
    @InjectRepository(PlanEntity)
    private readonly plans: Repository<PlanEntity>,
    @InjectRepository(BusinessEntity)
    private readonly businesses: Repository<BusinessEntity>,
    private readonly dataSource: DataSource,
    private readonly gateways: PaymentGatewayFactory,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
  ) {}

  async startCheckout(ownerId: number, dto: InitiateSubscriptionPaymentDto) {
    const [business, plan] = await Promise.all([
      this.businesses.findOne({
        where: { business_id: dto.businessId, owner: { id: ownerId } },
        relations: { owner: true },
      }),
      this.plans.findOne({ where: { id: dto.planId, isActive: true } }),
    ]);
    if (!business) throw new ForbiddenException('You do not own this business');
    if (!plan) throw new NotFoundException('Active plan not found');
    if (plan.type === PlanType.FREE) {
      throw new BadRequestException('The Free plan does not need payment');
    }

    // PostgreSQL returns decimal columns as strings. The database price is the authority.
    const priceText = String(plan.price);
    const amount = Number(priceText);
    if (
      !/^\d+(\.\d{1,2})?$/.test(priceText) ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      !Number.isSafeInteger(Math.round(amount * 100))
    ) {
      throw new InternalServerErrorException('Plan price is invalid');
    }

    const callbackBase = this.config.get<string>('PAYMENT_CALLBACK_BASE_URL');
    if (!callbackBase) {
      throw new InternalServerErrorException(
        'PAYMENT_CALLBACK_BASE_URL is not configured',
      );
    }
    let baseUrl: URL;
    try {
      baseUrl = new URL(callbackBase);
    } catch {
      throw new InternalServerErrorException(
        'PAYMENT_CALLBACK_BASE_URL is invalid',
      );
    }
    if (
      this.config.get<string>('NODE_ENV') === 'production' &&
      baseUrl.protocol !== 'https:'
    ) {
      throw new InternalServerErrorException(
        'Payment callback URL must use HTTPS',
      );
    }

    const provider = dto.paymentProvider;
    const gateway = this.gateways.resolve(provider);
    if (!gateway.supportsCurrency('NPR')) {
      throw new BadRequestException('This provider does not support NPR');
    }

    const previous = await this.transactions.findOne({
      where: { ownerId, requestId: dto.requestId },
    });
    if (previous) return this.existingCheckout(previous, dto);

    // Save a local attempt before contacting the gateway. Its UUID is our order ID.
    let attempt: PaymentTransactionEntity;
    try {
      attempt = await this.transactions.save(
        this.transactions.create({
          businessId: business.business_id,
          ownerId,
          requestId: dto.requestId,
          planId: plan.id,
          provider,
          amount,
          currency: 'NPR',
          status: TransactionStatus.PENDING,
          providerTransactionId: null,
          checkoutUrl: null,
          subscriptionId: null,
        }),
      );
    } catch (error) {
      // A simultaneous retry may have inserted the same request ID first.
      if (error?.code === '23505') {
        const winner = await this.transactions.findOne({
          where: { ownerId, requestId: dto.requestId },
        });
        if (winner) return this.existingCheckout(winner, dto);
      }
      throw error;
    }

    const callbackPath = `/subscription-payments/return/${provider.toLowerCase()}`;
    const request: PaymentRequest = {
      orderId: attempt.id,
      businessId: business.business_id,
      planId: plan.id,
      amount,
      currency: 'NPR',
      customerEmail: business.owner.email,
      customerName: business.business_name,
      returnUrl: new URL(callbackPath, baseUrl).toString(),
      cancelUrl: new URL(
        '/subscription-payments/return/esewa/failure',
        baseUrl,
      ).toString(),
      websiteUrl:
        this.config.get<string>('PAYMENT_WEBSITE_URL') || baseUrl.origin,
    };

    try {
      const checkout = await gateway.createPayment(request);
      if (
        checkout.status !== PaymentStatus.PENDING ||
        !checkout.transactionId
      ) {
        throw new BadGatewayException(
          'Payment provider did not start a session',
        );
      }
      await this.transactions.update(attempt.id, {
        providerTransactionId: checkout.transactionId,
        checkoutUrl: checkout.redirectUrl,
        gatewayPayload: checkout.rawResponse,
      });
      return {
        paymentId: attempt.id,
        provider,
        amount,
        currency: 'NPR',
        status: TransactionStatus.PENDING,
        method: provider === PaymentProvider.ESEWA ? 'POST' : 'GET',
        redirectUrl: checkout.redirectUrl,
        formFields: checkout.formFields,
      };
    } catch (error) {
      await this.transactions.update(attempt.id, {
        status: TransactionStatus.ERROR,
        errorMessage:
          error instanceof Error ? error.message : 'Payment initiation failed',
      });
      throw error;
    }
  }

  private existingCheckout(
    attempt: PaymentTransactionEntity,
    dto: InitiateSubscriptionPaymentDto,
  ) {
    if (
      attempt.businessId !== dto.businessId ||
      attempt.planId !== dto.planId ||
      attempt.provider !== dto.paymentProvider
    ) {
      throw new BadRequestException(
        'Request ID was already used for a different checkout',
      );
    }
    if (
      attempt.status === TransactionStatus.PENDING &&
      attempt.providerTransactionId &&
      attempt.checkoutUrl
    ) {
      return {
        paymentId: attempt.id,
        provider: attempt.provider,
        amount: Number(attempt.amount),
        currency: attempt.currency,
        status: attempt.status,
        method: attempt.provider === PaymentProvider.ESEWA ? 'POST' : 'GET',
        redirectUrl: attempt.checkoutUrl,
        formFields:
          attempt.provider === PaymentProvider.ESEWA
            ? attempt.gatewayPayload
            : undefined,
      };
    }
    if (attempt.status === TransactionStatus.SUCCEEDED)
      return this.publicStatus(attempt);
    throw new BadRequestException(
      'Checkout is initializing or has ended; use a new request ID',
    );
  }

  /** Authenticated polling endpoint; a browser return uses confirmReference instead. */
  async getPaymentStatus(ownerId: number, paymentId: string) {
    const attempt = await this.transactions.findOne({
      where: { id: paymentId, ownerId },
    });
    if (!attempt) throw new NotFoundException('Payment not found');
    if (!attempt.providerTransactionId) {
      return this.publicStatus(attempt);
    }
    return this.confirmReference(
      attempt.provider,
      attempt.providerTransactionId,
    );
  }

  /** Provider redirects are untrusted. They only identify an attempt to verify. */
  async confirmReference(provider: PaymentProvider, reference: string) {
    if (!reference) throw new BadRequestException('Missing payment reference');
    const attempt = await this.transactions.findOne({
      where: { provider, providerTransactionId: reference },
    });
    if (!attempt) throw new NotFoundException('Payment attempt not found');
    if (attempt.status === TransactionStatus.SUCCEEDED) {
      await this.redis.invalidateSubscription(attempt.businessId);
      return this.publicStatus(attempt);
    }

    const result = await this.gateways
      .resolve(provider)
      .verifyPayment(reference, Number(attempt.amount));
    this.assertProviderResult(attempt, result);

    if (result.status === PaymentStatus.SUCCEEDED) {
      await this.applyConfirmedPayment(attempt.id, result);
      await this.redis.invalidateSubscription(attempt.businessId);
    } else {
      await this.transactions.update(
        { id: attempt.id, status: Not(TransactionStatus.SUCCEEDED) },
        {
          status: this.transactionStatus(result.status),
          gatewayPayload: result.rawResponse,
        },
      );
    }
    const updated = await this.transactions.findOneByOrFail({ id: attempt.id });
    return this.publicStatus(updated);
  }

  private assertProviderResult(
    attempt: PaymentTransactionEntity,
    result: PaymentResponse,
  ) {
    if (result.transactionId !== attempt.providerTransactionId) {
      throw new BadGatewayException('Payment reference did not match');
    }
    if (
      result.status === PaymentStatus.SUCCEEDED &&
      (result.currency !== attempt.currency ||
        !Number.isFinite(result.amount) ||
        Math.round(result.amount * 100) !==
          Math.round(Number(attempt.amount) * 100))
    ) {
      throw new BadGatewayException('Payment amount or currency did not match');
    }
  }

  /** The row locks and status check make repeated callbacks safe. */
  private async applyConfirmedPayment(
    paymentId: string,
    result: PaymentResponse,
  ) {
    await this.dataSource.transaction(async (manager) => {
      const payment = await manager.findOne(PaymentTransactionEntity, {
        where: { id: paymentId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!payment || payment.status === TransactionStatus.SUCCEEDED) return;

      // Serialize changes to subscriptions for the same business.
      const business = await manager
        .getRepository(BusinessEntity)
        .createQueryBuilder('business')
        .innerJoinAndSelect('business.owner', 'owner')
        .setLock('pessimistic_write')
        .where('business.business_id = :id', { id: payment.businessId })
        .getOne();
      if (!business) throw new NotFoundException('Business no longer exists');
      if (business.owner.id !== payment.ownerId) {
        throw new ForbiddenException(
          'Business owner changed before payment confirmation',
        );
      }
      const plan = await manager.findOneBy(PlanEntity, { id: payment.planId });
      if (!plan) throw new NotFoundException('Plan no longer exists');

      const current = await manager.findOne(BusinessSubscriptionEntity, {
        where: {
          businessId: payment.businessId,
          status: SubscriptionStatus.ACTIVE,
        },
        order: { subscriptionId: 'DESC' },
      });
      const now = new Date();
      let subscription: BusinessSubscriptionEntity;

      // Renewing the same paid plan preserves its unused time.
      if (
        current &&
        current.planId === plan.id &&
        current.endsAt &&
        current.endsAt > now
      ) {
        const endsAt = this.addBillingCycle(current.endsAt, plan.billingCycle);
        await manager.update(
          BusinessSubscriptionEntity,
          current.subscriptionId,
          {
            endsAt,
            nextBillingDate: endsAt,
            lastBillingDate: now,
            nextPaymentAmount: plan.price,
          },
        );
        subscription = current;
      } else {
        await manager.update(
          BusinessSubscriptionEntity,
          {
            businessId: payment.businessId,
            status: SubscriptionStatus.ACTIVE,
          },
          { status: SubscriptionStatus.INACTIVE },
        );
        const endsAt = this.addBillingCycle(now, plan.billingCycle);
        subscription = await manager.save(
          manager.create(BusinessSubscriptionEntity, {
            businessId: payment.businessId,
            planId: plan.id,
            subscriptionType: plan.billingCycle,
            status: SubscriptionStatus.ACTIVE,
            startsAt: now,
            endsAt,
            lastBillingDate: now,
            nextBillingDate: endsAt,
            nextPaymentAmount: plan.price,
          }),
        );
      }
      await manager.update(PaymentTransactionEntity, payment.id, {
        status: TransactionStatus.SUCCEEDED,
        subscriptionId: subscription.subscriptionId,
        gatewayPayload: result.rawResponse,
        completedAt: now,
      });
    });
  }

  private addBillingCycle(start: Date, cycle: PlanBillingCycle): Date {
    const months =
      cycle === PlanBillingCycle.YEARLY
        ? 12
        : cycle === PlanBillingCycle.QUARTERLY
          ? 3
          : 1;
    const end = new Date(start);
    const day = end.getUTCDate();
    end.setUTCDate(1);
    end.setUTCMonth(end.getUTCMonth() + months);
    const lastDay = new Date(
      Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0),
    ).getUTCDate();
    end.setUTCDate(Math.min(day, lastDay));
    return end;
  }

  private transactionStatus(status: PaymentStatus): TransactionStatus {
    switch (status) {
      case PaymentStatus.SUCCEEDED:
        return TransactionStatus.SUCCEEDED;
      case PaymentStatus.FAILED:
        return TransactionStatus.FAILED;
      case PaymentStatus.CANCELLED:
        return TransactionStatus.CANCELLED;
      case PaymentStatus.REFUNDED:
        return TransactionStatus.REFUNDED;
      default:
        return TransactionStatus.PENDING;
    }
  }

  private publicStatus(attempt: PaymentTransactionEntity) {
    return {
      paymentId: attempt.id,
      status: attempt.status,
    };
  }
}
