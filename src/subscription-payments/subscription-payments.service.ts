import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { BusinessEntity } from 'src/bussiness/entities/bussiness.entity';
import {
  BusinessSubscriptionEntity,
  SubscriptionStatus,
} from 'src/business-subscription/entities/business-subscription.entity';
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
  private readonly logger = new Logger(SubscriptionPaymentsService.name);

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
  ) {}

  async startCheckout(ownerId: number, dto: InitiateSubscriptionPaymentDto) {
    const business = await this.businesses.findOne({
      where: { business_id: dto.businessId, owner: { id: ownerId } },
      relations: { owner: true },
    });
    if (!business) throw new ForbiddenException('You do not own this business');

    const previous = await this.transactions.findOne({
      where: { ownerId, requestId: dto.requestId },
    });
    if (previous) return this.existingCheckout(previous, dto);

    const plan = await this.plans.findOne({
      where: { id: dto.planId, isActive: true },
    });
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
    const websiteUrl =
      this.config.get<string>('PAYMENT_WEBSITE_URL') || baseUrl.origin;
    let website: URL;
    try {
      website = new URL(websiteUrl);
    } catch {
      throw new InternalServerErrorException('PAYMENT_WEBSITE_URL is invalid');
    }
    if (
      this.config.get<string>('NODE_ENV') === 'production' &&
      website.protocol !== 'https:'
    ) {
      throw new InternalServerErrorException(
        'PAYMENT_WEBSITE_URL must use HTTPS',
      );
    }

    const provider = dto.paymentProvider;
    const gateway = this.gateways.resolve(provider);
    if (!gateway.supportsCurrency('NPR')) {
      throw new BadRequestException('This provider does not support NPR');
    }

    // Save a local attempt before contacting the gateway. Its UUID is our order ID.
    let attempt: PaymentTransactionEntity;
    let created: boolean;
    try {
      const reservation = await this.dataSource.transaction(async (manager) => {
        // The owner row serializes competing checkouts, including requests with different UUIDs.
        const lockedBusiness = await manager
          .getRepository(BusinessEntity)
          .createQueryBuilder('business')
          .innerJoinAndSelect('business.owner', 'owner')
          .setLock('pessimistic_write')
          .where('business.business_id = :id', { id: dto.businessId })
          .getOneOrFail();
        if (lockedBusiness.owner.id !== ownerId) {
          throw new ForbiddenException('You do not own this business');
        }
        const open = await manager.findOne(PaymentTransactionEntity, {
          where: {
            businessId: dto.businessId,
            status: In([
              TransactionStatus.INITIATING,
              TransactionStatus.PENDING,
              TransactionStatus.PROCESSING,
              TransactionStatus.NEEDS_REVIEW,
            ]),
          },
        });
        if (open) return { attempt: open, created: false };
        const saved = await manager.save(
          PaymentTransactionEntity,
          manager.create(PaymentTransactionEntity, {
            businessId: business.business_id,
            ownerId,
            requestId: dto.requestId,
            planId: plan.id,
            billingCycle: plan.billingCycle,
            provider,
            amount,
            currency: 'NPR',
            status: TransactionStatus.INITIATING,
            providerTransactionId: null,
            checkoutUrl: null,
            subscriptionId: null,
            nextCheckAt: new Date(Date.now() + 2 * 60_000),
            lastCheckedAt: null,
            checkAttempts: 0,
          }),
        );
        return { attempt: saved, created: true };
      });
      attempt = reservation.attempt;
      created = reservation.created;
    } catch (error: unknown) {
      // A simultaneous retry may have inserted the same request ID first.
      const dbError =
        typeof error === 'object' && error !== null
          ? (error as { code?: string; driverError?: { code?: string } })
          : null;
      if ((dbError?.code ?? dbError?.driverError?.code) === '23505') {
        const winner = await this.transactions.findOne({
          where: [
            { ownerId, requestId: dto.requestId },
            {
              businessId: dto.businessId,
              status: In([
                TransactionStatus.INITIATING,
                TransactionStatus.PENDING,
                TransactionStatus.PROCESSING,
                TransactionStatus.NEEDS_REVIEW,
              ]),
            },
          ],
        });
        if (winner) return this.existingCheckout(winner, dto);
      }
      throw error;
    }

    if (!created) return this.existingCheckout(attempt, dto);

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
      websiteUrl,
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
        status: TransactionStatus.PENDING,
        providerTransactionId: checkout.transactionId,
        checkoutUrl: checkout.redirectUrl,
        gatewayPayload: checkout.rawResponse,
        nextCheckAt: new Date(Date.now() + 2 * 60_000),
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
        status:
          provider === PaymentProvider.KHALTI
            ? TransactionStatus.NEEDS_REVIEW
            : TransactionStatus.ERROR,
        errorMessage:
          error instanceof Error ? error.message : 'Payment initiation failed',
        nextCheckAt:
          provider === PaymentProvider.KHALTI
            ? new Date(Date.now() + 2 * 60_000)
            : null,
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
      throw new ConflictException(
        'Another checkout for this business is unresolved',
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
    if (
      [
        TransactionStatus.INITIATING,
        TransactionStatus.NEEDS_REVIEW,
        TransactionStatus.SUCCEEDED,
      ].includes(attempt.status)
    )
      return this.publicStatus(attempt);
    throw new ConflictException('Checkout has ended; use a new request ID');
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
    try {
      return await this.confirmReference(
        attempt.provider,
        attempt.providerTransactionId,
      );
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        this.logger.warn(
          `Provider status temporarily unavailable for payment ${paymentId}`,
        );
        return { ...this.publicStatus(attempt), verificationPending: true };
      }
      throw error;
    }
  }

  /** Provider redirects are untrusted. They only identify an attempt to verify. */
  async confirmReference(provider: PaymentProvider, reference: string) {
    if (!reference) throw new BadRequestException('Missing payment reference');
    const attempt = await this.transactions.findOne({
      where: { provider, providerTransactionId: reference },
    });
    if (!attempt) throw new NotFoundException('Payment attempt not found');
    const result = await this.gateways
      .resolve(provider)
      .verifyPayment(reference, Number(attempt.amount));
    this.assertProviderResult(attempt, result);

    if (
      result.status === PaymentStatus.SUCCEEDED &&
      attempt.status !== TransactionStatus.REFUNDED &&
      attempt.status !== TransactionStatus.PARTIALLY_REFUNDED
    ) {
      await this.applyConfirmedPayment(attempt.id, result);
      if (attempt.status === TransactionStatus.SUCCEEDED) {
        const now = new Date();
        await this.transactions.update(attempt.id, {
          lastCheckedAt: now,
          nextCheckAt: new Date(now.getTime() + 24 * 60 * 60_000),
        });
      }
    } else if (
      [PaymentStatus.REFUNDED, PaymentStatus.PARTIALLY_REFUNDED].includes(
        result.status,
      )
    ) {
      await this.applyRefund(attempt.id, result);
    } else {
      const status =
        attempt.status === TransactionStatus.SUCCEEDED ||
        attempt.status === TransactionStatus.REFUNDED ||
        attempt.status === TransactionStatus.PARTIALLY_REFUNDED
          ? attempt.status
          : this.transactionStatus(result.status);
      await this.transactions.update(
        { id: attempt.id },
        {
          status,
          gatewayPayload: result.rawResponse,
          lastCheckedAt: new Date(),
          nextCheckAt:
            status === TransactionStatus.FAILED ||
            status === TransactionStatus.CANCELLED
              ? null
              : new Date(Date.now() + 2 * 60_000),
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
      [
        PaymentStatus.SUCCEEDED,
        PaymentStatus.REFUNDED,
        PaymentStatus.PARTIALLY_REFUNDED,
      ].includes(result.status) &&
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
      if (!payment || payment.subscriptionId) return;

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
      let grantStartsAt: Date;
      let grantEndsAt: Date;

      // Renewing the same paid plan preserves its unused time.
      if (
        current &&
        current.planId === plan.id &&
        current.endsAt &&
        current.endsAt > now
      ) {
        grantStartsAt = current.endsAt;
        const endsAt = this.addBillingCycle(
          current.endsAt,
          (payment.billingCycle as PlanBillingCycle) || plan.billingCycle,
        );
        grantEndsAt = endsAt;
        await manager.update(
          BusinessSubscriptionEntity,
          current.subscriptionId,
          {
            endsAt,
            nextBillingDate: endsAt,
            lastBillingDate: now,
            nextPaymentAmount: payment.amount,
          },
        );
        subscription = current;
      } else {
        grantStartsAt = now;
        await manager.update(
          BusinessSubscriptionEntity,
          {
            businessId: payment.businessId,
            status: SubscriptionStatus.ACTIVE,
          },
          { status: SubscriptionStatus.INACTIVE },
        );
        const endsAt = this.addBillingCycle(
          now,
          (payment.billingCycle as PlanBillingCycle) || plan.billingCycle,
        );
        grantEndsAt = endsAt;
        subscription = await manager.save(
          manager.create(BusinessSubscriptionEntity, {
            businessId: payment.businessId,
            planId: plan.id,
            subscriptionType:
              (payment.billingCycle as PlanBillingCycle) || plan.billingCycle,
            status: SubscriptionStatus.ACTIVE,
            startsAt: now,
            endsAt,
            lastBillingDate: now,
            nextBillingDate: endsAt,
            nextPaymentAmount: payment.amount,
          }),
        );
      }
      if (business.requiresPaidSubscription && !business.isActive) {
        await manager.update(BusinessEntity, payment.businessId, {
          isActive: true,
        });
      }
      await manager.update(PaymentTransactionEntity, payment.id, {
        status: TransactionStatus.SUCCEEDED,
        subscriptionId: subscription.subscriptionId,
        gatewayPayload: result.rawResponse,
        completedAt: now,
        grantStartsAt,
        grantEndsAt,
        lastCheckedAt: now,
        nextCheckAt: new Date(now.getTime() + 24 * 60 * 60_000),
      });
    });
  }

  /** A refunded billing period no longer grants paid time. Later paid periods remain. */
  private async applyRefund(paymentId: string, result: PaymentResponse) {
    await this.dataSource.transaction(async (manager) => {
      const payment = await manager.findOne(PaymentTransactionEntity, {
        where: { id: paymentId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!payment) throw new NotFoundException('Payment not found');
      const status = this.transactionStatus(result.status);
      const now = new Date();
      if (payment.status === status) {
        await manager.update(PaymentTransactionEntity, payment.id, {
          lastCheckedAt: now,
          nextCheckAt: new Date(now.getTime() + 24 * 60 * 60_000),
        });
        return;
      }
      const business = await manager
        .getRepository(BusinessEntity)
        .createQueryBuilder('business')
        .setLock('pessimistic_write')
        .where('business.business_id = :id', { id: payment.businessId })
        .getOneOrFail();
      await manager.update(PaymentTransactionEntity, payment.id, {
        status,
        gatewayPayload: result.rawResponse,
        lastCheckedAt: now,
        nextCheckAt: new Date(now.getTime() + 24 * 60 * 60_000),
      });
      if (!payment.subscriptionId) return;
      const subscription = await manager.findOne(BusinessSubscriptionEntity, {
        where: { subscriptionId: payment.subscriptionId },
      });
      if (!subscription || subscription.status !== SubscriptionStatus.ACTIVE)
        return;
      const surviving = await manager.find(PaymentTransactionEntity, {
        where: {
          subscriptionId: subscription.subscriptionId,
          status: TransactionStatus.SUCCEEDED,
        },
        order: { completedAt: 'ASC' },
      });
      const knownEnds = surviving
        .map((paid) => paid.grantEndsAt)
        .filter((end): end is Date => !!end);
      const endsAt = knownEnds.length
        ? new Date(Math.max(...knownEnds.map((end) => end.getTime())))
        : surviving.length
          ? subscription.endsAt
          : null;
      if (surviving.length && endsAt && endsAt > now) {
        await manager.update(
          BusinessSubscriptionEntity,
          subscription.subscriptionId,
          {
            endsAt,
            nextBillingDate: endsAt,
          },
        );
        return;
      }
      await manager.update(
        BusinessSubscriptionEntity,
        subscription.subscriptionId,
        { status: SubscriptionStatus.INACTIVE },
      );
      if (business.requiresPaidSubscription) {
        await manager.update(BusinessEntity, business.business_id, {
          isActive: false,
        });
        return;
      }
      const free = await manager.findOne(PlanEntity, {
        where: { type: PlanType.FREE, isActive: true },
      });
      if (!free) throw new InternalServerErrorException('Free plan not found');
      await manager.save(
        BusinessSubscriptionEntity,
        manager.create(BusinessSubscriptionEntity, {
          businessId: payment.businessId,
          planId: free.id,
          subscriptionType: free.billingCycle,
          status: SubscriptionStatus.ACTIVE,
          startsAt: now,
          endsAt: null,
          lastBillingDate: null,
          nextBillingDate: null,
          nextPaymentAmount: null,
        }),
      );
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
      case PaymentStatus.PARTIALLY_REFUNDED:
        return TransactionStatus.PARTIALLY_REFUNDED;
      case PaymentStatus.UNKNOWN:
        return TransactionStatus.NEEDS_REVIEW;
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
