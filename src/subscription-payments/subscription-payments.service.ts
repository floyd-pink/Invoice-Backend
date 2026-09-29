import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import crypto from 'crypto';

import { PaymentGatewayFactory } from './factories/payment-gateway.factory';
import { PaymentProvider, PaymentRequest, PaymentStatus } from './interfaces';
import {
  PaymentTransactionEntity,
  TransactionStatus,
} from './entities/payment-transaction.entity';
import { PlanEntity } from 'src/plans/entities/plan.entity';
import { BusinessEntity } from 'src/bussiness/entities/bussiness.entity';
import {
  BusinessSubscriptionEntity,
  SubscriptionStatus,
} from 'src/business-subscription/entities/business-subscription.entity';

@Injectable()
export class SubscriptionPaymentsService {
  constructor(
    @InjectRepository(PaymentTransactionEntity)
    private readonly transactionRepo: Repository<PaymentTransactionEntity>,

    @InjectRepository(PlanEntity)
    private readonly planRepo: Repository<PlanEntity>,

    @InjectRepository(BusinessEntity)
    private readonly businessRepo: Repository<BusinessEntity>,

    @InjectRepository(BusinessSubscriptionEntity)
    private readonly subscriptionRepo: Repository<BusinessSubscriptionEntity>,

    private readonly dataSource: DataSource,

    private readonly gatewayFactory: PaymentGatewayFactory,
  ) {}

  async initiatePayment(dto: {
    businessId: string;
    planId: number;
    customerId: string;
    paymentProvider: PaymentProvider;
    amount?: number;
    currency?: string;
    returnUrl?: string;
    cancelUrl?: string;
    subscriptionId?: number;
  }): Promise<any> {
    const [plan, business] = await Promise.all([
      this.planRepo.findOne({ where: { id: dto.planId } }),
      this.businessRepo.findOne({
        where: { business_id: dto.businessId },
        relations: { owner: true },
      }),
    ]);

    if (!plan) throw new NotFoundException(`Plan not found: ${dto.planId}`);
    if (!business)
      throw new NotFoundException(`Business not found: ${dto.businessId}`);
    if (!plan.isActive) throw new BadRequestException('Plan is not active');

    const paymentRequest: PaymentRequest = {
      amount: dto.amount ?? Number(plan.price),
      currency: dto.currency ?? 'NPR',
      businessId: dto.businessId,
      subscriptionId: dto.subscriptionId,
      planId: plan.id,
      billingCycle: plan.billingCycle,
      customerId: dto.customerId,
      customerEmail: business.owner?.email ?? dto.customerId,
      customerName: business.business_name,
      returnUrl: dto.returnUrl,
      cancelUrl: dto.cancelUrl,
    };

    const idempotencyKey = this.buildIdempotencyKey(dto);
    const existing = await this.transactionRepo.findOne({
      where: { idempotencyKey },
    });

    let transaction: PaymentTransactionEntity;

    if (existing) {
      // Case 1: Still pending → re-verify with gateway
      if (
        existing.status === TransactionStatus.PENDING ||
        existing.status === TransactionStatus.PROCESSING
      ) {
        const gateway = this.gatewayFactory.resolve(dto.paymentProvider);
        try {
          const currentStatus = await gateway.verifyPayment(
            existing.providerTransactionId,
          );
          await this.transactionRepo.update(existing.id, {
            status: this.mapToTransactionStatus(currentStatus.status),
            gatewayPayload: currentStatus.rawResponse,
            completedAt:
              currentStatus.status === PaymentStatus.SUCCEEDED
                ? new Date()
                : undefined,
          });
          if (currentStatus.status === PaymentStatus.SUCCEEDED)
            await this.activateSubscription(existing);
          return {
            ...currentStatus,
            message: 'Retrieved existing payment session',
          };
        } catch {
          return {
            status: PaymentStatus.FAILED,
            transactionId: existing.providerTransactionId,
            message: 'Failed to verify existing payment session',
          };
        }
      }

      // Case 2: Already succeeded
      if (existing.status === TransactionStatus.SUCCEEDED) {
        return {
          status: PaymentStatus.SUCCEEDED,
          transactionId: existing.providerTransactionId,
          message: 'Payment already completed successfully',
        };
      }

      // Case 3: Previous attempt failed/cancelled → REUSE existing record
      await this.transactionRepo.update(existing.id, {
        status: TransactionStatus.PENDING,
        errorMessage: undefined,
        retryCount: existing.retryCount + 1,
        providerTransactionId: undefined,
        gatewayPayload: undefined,
        completedAt: null,
      });
      transaction = existing; // ← KEY: reuse existing record
    } else {
      // No existing transaction - create new
      transaction = this.transactionRepo.create({
        providerTransactionId: crypto.randomUUID(),
        provider: dto.paymentProvider,
        status: TransactionStatus.PENDING,
        amount: paymentRequest.amount,
        currency: paymentRequest.currency,
        businessId: dto.businessId,
        subscriptionId: dto.subscriptionId,
        planId: dto.planId,
        customerId: dto.customerId,
        idempotencyKey,
      });
      await this.transactionRepo.save(transaction);
    }

    // Single gateway call for both new and reused transactions
    const gateway = this.gatewayFactory.resolve(dto.paymentProvider);
    try {
      const response = await gateway.createPayment(paymentRequest);
      await this.transactionRepo.update(transaction.id, {
        status: this.mapToTransactionStatus(response.status),
        providerTransactionId: response.transactionId,
        gatewayPayload: response.rawResponse,
      });
      return response;
    } catch (error) {
      await this.transactionRepo.update(transaction.id, {
        status: TransactionStatus.ERROR,
        errorMessage: error.message,
        retryCount: (transaction.retryCount || 0) + 1,
        completedAt: null,
      });
      throw error;
    }
  }

  async verifyPayment(
    provider: PaymentProvider,
    transactionId: string,
  ): Promise<any> {
    const gateway = this.gatewayFactory.resolve(provider);
    const response = await gateway.verifyPayment(transactionId);

    const tx = await this.transactionRepo.findOne({
      where: { providerTransactionId: transactionId },
    });

    if (!tx) {
      throw new NotFoundException(`Transaction not found: ${transactionId}`);
    }

    await this.transactionRepo.update(tx.id, {
      status: this.mapToTransactionStatus(response.status),
      gatewayPayload: response.rawResponse,
      completedAt:
        response.status === PaymentStatus.SUCCEEDED ? new Date() : undefined,
    });

    if (response.status === PaymentStatus.SUCCEEDED) {
      await this.activateSubscription(tx);
    }

    return response;
  }

  async handleWebhook(
    provider: PaymentProvider,
    payload: unknown,
    signature?: string,
    rawBody?: Buffer,
  ): Promise<any> {
    if (provider === PaymentProvider.STRIPE) {
      this.verifyStripeSignature(payload, signature, rawBody);
    }

    const gateway = this.gatewayFactory.resolve(provider);
    const response = await gateway.handleWebhook(payload);

    const existing = await this.transactionRepo.findOne({
      where: { providerTransactionId: response.transactionId },
    });

    if (existing?.status === TransactionStatus.SUCCEEDED) {
      return response;
    }

    if (!existing) {
      await this.transactionRepo.save({
        providerTransactionId: response.transactionId,
        provider,
        status: this.mapToTransactionStatus(response.status),
        amount: response.amount,
        currency: response.currency,
        businessId: '',
        customerId: '',
        planId: 0,
        idempotencyKey: response.transactionId,
        gatewayPayload: response.rawResponse,
      });
    } else {
      await this.transactionRepo.update(existing.id, {
        status: this.mapToTransactionStatus(response.status),
        gatewayPayload: response.rawResponse,
        completedAt:
          response.status === PaymentStatus.SUCCEEDED ? new Date() : undefined,
      });
    }

    if (response.status === PaymentStatus.SUCCEEDED && existing) {
      await this.activateSubscription(existing);
    }

    return response;
  }

  private verifyStripeSignature(
    payload: unknown,
    signature?: string,
    rawBody?: Buffer,
  ): void {
    if (!signature || !rawBody) {
      throw new BadRequestException('Missing Stripe signature or raw body');
    }

    const stripeGateway = this.gatewayFactory.resolve(
      PaymentProvider.STRIPE,
    ) as any;
    const webhookSecret = stripeGateway.getWebhookSecret?.();

    if (!webhookSecret) {
      throw new BadRequestException('Stripe webhook secret is not configured');
    }

    try {
      const Stripe = require('stripe');
      Stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err) {
      throw new BadRequestException(`Invalid Stripe signature: ${err.message}`);
    }
  }

  private async activateSubscription(
    tx: PaymentTransactionEntity,
  ): Promise<void> {
    if (!tx.subscriptionId) return;

    const subscription = await this.subscriptionRepo.findOne({
      where: { subscriptionId: tx.subscriptionId },
    });

    if (!subscription) return;

    const now = new Date();
    await this.subscriptionRepo.update(tx.subscriptionId, {
      status: SubscriptionStatus.ACTIVE,
      lastBillingDate: now,
      nextBillingDate: this.addMonths(now, 1),
    });
  }

  private buildIdempotencyKey(dto: {
    businessId: string;
    planId: number;
    customerId: string;
    paymentProvider: PaymentProvider;
    subscriptionId?: number;
  }): string {
    return `${dto.businessId}:${dto.subscriptionId ?? 'onetime'}:${dto.planId}:${dto.paymentProvider}`;
  }

  private mapToTransactionStatus(status: PaymentStatus): TransactionStatus {
    const map: Record<PaymentStatus, TransactionStatus> = {
      [PaymentStatus.PENDING]: TransactionStatus.PENDING,
      [PaymentStatus.SUCCEEDED]: TransactionStatus.SUCCEEDED,
      [PaymentStatus.FAILED]: TransactionStatus.FAILED,
      [PaymentStatus.CANCELLED]: TransactionStatus.CANCELLED,
      [PaymentStatus.REFUNDED]: TransactionStatus.REFUNDED,
    };
    return map[status] ?? TransactionStatus.ERROR;
  }

  private addMonths(date: Date, months: number): Date {
    const d = new Date(date);
    d.setMonth(d.getMonth() + months);
    return d;
  }
}
