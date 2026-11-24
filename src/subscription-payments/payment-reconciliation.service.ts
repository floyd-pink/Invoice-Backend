import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { DataSource, LessThanOrEqual, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import {
  PaymentTransactionEntity,
  TransactionStatus,
} from './entities/payment-transaction.entity';
import { PaymentProvider } from './enums/payment-provider.enum';
import { SubscriptionPaymentsService } from './subscription-payments.service';
import {
  BusinessSubscriptionEntity,
  SubscriptionStatus,
} from 'src/business-subscription/entities/business-subscription.entity';
import { BusinessEntity } from 'src/bussiness/entities/bussiness.entity';
import { PlanEntity } from 'src/plans/entities/plan.entity';
import { PlanType } from 'src/plans/enum/plan-type.enum';
import { PaymentConfigurationValidator } from './payment-configuration.validator';

/** Rechecks payments even when the customer never reaches the return URL. */
@Injectable()
export class PaymentReconciliationService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly lookupConcurrency = 4;
  private readonly logger = new Logger(PaymentReconciliationService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(PaymentTransactionEntity)
    private readonly payments: Repository<PaymentTransactionEntity>,
    private readonly subscriptions: SubscriptionPaymentsService,
    private readonly paymentConfig: PaymentConfigurationValidator,
  ) {}

  async onModuleInit() {
    this.paymentConfig.validate();
    await this.dataSource.query(
      'SELECT next_check_at, grant_starts_at, grant_ends_at FROM payment_transactions LIMIT 0',
    );
    await this.dataSource.query(
      'SELECT lookup_started_at, provider_observed_at, provider_expires_at, checkout_form_fields FROM payment_transactions LIMIT 0',
    );
    await this.dataSource.query(
      'SELECT free_business_created FROM users LIMIT 0',
    );
    await this.dataSource.query(
      'SELECT is_active, requires_paid_subscription FROM business LIMIT 0',
    );
    const indexes: Array<{ indexname: string }> = await this.dataSource.query(`
      SELECT indexname FROM pg_indexes
      WHERE schemaname = current_schema()
        AND tablename IN ('payment_transactions', 'business_subscription')
        AND indexname IN ('UQ_PAYMENT_OWNER_REQUEST', 'UQ_PAYMENT_PROVIDER_REFERENCE',
                          'UQ_PAYMENT_OPEN_BUSINESS', 'UQ_ACTIVE_BUSINESS_SUBSCRIPTION')
    `);
    const found = new Set(indexes.map((index) => index.indexname));
    for (const required of [
      'UQ_PAYMENT_OWNER_REQUEST',
      'UQ_PAYMENT_PROVIDER_REFERENCE',
      'UQ_PAYMENT_OPEN_BUSINESS',
      'UQ_ACTIVE_BUSINESS_SUBSCRIPTION',
    ]) {
      if (!found.has(required))
        throw new Error(`Required payment index ${required} is missing`);
    }
    this.timer = setInterval(() => void this.runOnce(), 60_000);
    this.timer.unref();
    void this.runOnce();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async runOnce() {
    if (this.running) return;
    this.running = true;
    try {
      // SKIP LOCKED lets multiple servers claim different rows safely.
      // TypeORM's Postgres driver returns [rows, affectedCount] for UPDATE.
      const [due]: [Array<{ id: string; check_attempts: number }>, number] =
        await this.dataSource.query(`
        WITH due AS (
          SELECT id FROM payment_transactions
          WHERE next_check_at <= NOW()
            AND status IN ('INITIATING', 'PENDING', 'PROCESSING',
                           'NEEDS_REVIEW', 'SUCCEEDED', 'PARTIALLY_REFUNDED')
          ORDER BY next_check_at LIMIT 20
          FOR UPDATE SKIP LOCKED
        )
        UPDATE payment_transactions AS p
        SET next_check_at = NOW() + INTERVAL '5 minutes',
            check_attempts = p.check_attempts + 1
        FROM due WHERE p.id = due.id
        RETURNING p.id, p.check_attempts
        `);
      // A few lookups can run together without flooding either provider. One
      // failed row cannot prevent the other claimed payments from being checked.
      for (
        let offset = 0;
        offset < due.length;
        offset += this.lookupConcurrency
      ) {
        const batch = due.slice(offset, offset + this.lookupConcurrency);
        const results = await Promise.allSettled(
          batch.map((item) => this.reconcile(item.id, item.check_attempts)),
        );
        for (const result of results) {
          if (result.status === 'rejected') {
            this.logger.error(
              'A claimed payment could not be reconciled',
              result.reason instanceof Error ? result.reason.stack : undefined,
            );
          }
        }
      }
      await this.expireSubscriptions();
    } catch (error) {
      this.logger.error(
        'Payment reconciliation batch failed',
        error instanceof Error ? error.stack : undefined,
      );
    } finally {
      this.running = false;
    }
  }

  private async reconcile(id: string, checks: number) {
    const payment = await this.payments.findOneBy({ id });
    if (!payment) return;
    try {
      let reference = payment.providerTransactionId;
      if (!reference && payment.provider === PaymentProvider.ESEWA) {
        // eSewa's reference is deterministic from our saved UUID.
        reference = `SUB-${payment.id}`;
        await this.payments.update(payment.id, {
          providerTransactionId: reference,
        });
      }
      if (!reference) {
        // Khalti lookup requires pidx. No checkout URL was returned to the customer
        // before pidx was saved, so this session was never presented for payment.
        await this.payments.update(payment.id, {
          status: TransactionStatus.ERROR,
          nextCheckAt: null,
          errorMessage:
            'Checkout initiation did not return a provider reference',
        });
        this.logger.warn(`Payment ${id} has no provider reference`);
        return;
      }
      const result = await this.subscriptions.confirmReference(
        payment.provider,
        reference,
      );
      if (result.status === TransactionStatus.NEEDS_REVIEW && checks >= 5) {
        this.logger.error(
          `Payment ${id} still has no final provider result after ${checks} checks`,
        );
      }
    } catch {
      // A network error does not mean the customer did not pay.
      const minutes = Math.min(2 ** Math.min(checks, 8), 360);
      await this.payments.update(payment.id, {
        nextCheckAt: new Date(Date.now() + minutes * 60_000),
        lastCheckedAt: new Date(),
      });
      this.logger.warn(
        `Payment ${id} remains unresolved after provider lookup`,
      );
    }
  }

  private async expireSubscriptions() {
    const expired = await this.dataSource
      .getRepository(BusinessSubscriptionEntity)
      .find({
        where: {
          status: SubscriptionStatus.ACTIVE,
          endsAt: LessThanOrEqual(new Date()),
        },
        take: 20,
        order: { endsAt: 'ASC' },
      });
    for (const candidate of expired) {
      try {
        await this.dataSource.transaction(async (manager) => {
          const business = await manager.findOne(BusinessEntity, {
            where: { business_id: candidate.businessId },
            lock: { mode: 'pessimistic_write' },
          });
          if (!business) return;
          const subscription = await manager.findOne(
            BusinessSubscriptionEntity,
            {
              where: { subscriptionId: candidate.subscriptionId },
              lock: { mode: 'pessimistic_write' },
            },
          );
          if (
            !subscription ||
            subscription.status !== SubscriptionStatus.ACTIVE ||
            !subscription.endsAt ||
            subscription.endsAt > new Date()
          )
            return;
          await manager.update(
            BusinessSubscriptionEntity,
            subscription.subscriptionId,
            { status: SubscriptionStatus.EXPIRED },
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
          if (!free)
            throw new Error('Free plan missing during subscription expiry');
          await manager.save(
            BusinessSubscriptionEntity,
            manager.create(BusinessSubscriptionEntity, {
              businessId: business.business_id,
              planId: free.id,
              subscriptionType: free.billingCycle,
              status: SubscriptionStatus.ACTIVE,
              startsAt: new Date(),
              endsAt: null,
              nextBillingDate: null,
              lastBillingDate: null,
              nextPaymentAmount: null,
            }),
          );
        });
      } catch {
        this.logger.warn(
          `Could not expire subscription ${candidate.subscriptionId}`,
        );
      }
    }
  }
}
