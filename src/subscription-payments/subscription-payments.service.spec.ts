import { BadGatewayException, ForbiddenException } from '@nestjs/common';
import { BusinessEntity } from 'src/bussiness/entities/bussiness.entity';
import { BusinessSubscriptionEntity, SubscriptionStatus } from 'src/business-subscription/entities/business-subscription.entity';
import { PlanEntity } from 'src/plans/entities/plan.entity';
import { PlanBillingCycle, PlanType } from 'src/plans/enum/plan-type.enum';
import { PaymentTransactionEntity, TransactionStatus } from './entities/payment-transaction.entity';
import { PaymentProvider } from './enums/payment-provider.enum';
import { PaymentStatus } from './interfaces';
import { SubscriptionPaymentsService } from './subscription-payments.service';

describe('SubscriptionPaymentsService', () => {
  const business = {
    business_id: 'business-1',
    business_name: 'Shop',
    owner: { id: 7, email: 'owner@example.com' },
  };
  const plan = {
    id: 2,
    type: PlanType.PRO,
    isActive: true,
    price: '1000.00',
    billingCycle: PlanBillingCycle.MONTHLY,
  };
  const gateway = {
    supportsCurrency: jest.fn(() => true),
    createPayment: jest.fn(),
    verifyPayment: jest.fn(),
  };
  const transactions = {
    create: jest.fn((value) => value),
    save: jest.fn(),
    findOne: jest.fn(),
    findOneByOrFail: jest.fn(),
    update: jest.fn(),
  };
  const businesses = { findOne: jest.fn() };
  const plans = { findOne: jest.fn() };
  const dataSource = { transaction: jest.fn() };
  const redis = { invalidateSubscription: jest.fn() };
  const factory = { resolve: jest.fn(() => gateway) };
  const config = {
    get: jest.fn((name: string) => ({
      PAYMENT_CALLBACK_BASE_URL: 'https://api.example.com',
    })[name]),
  };
  const service = new SubscriptionPaymentsService(
    transactions as never,
    plans as never,
    businesses as never,
    dataSource as never,
    factory as never,
    config as never,
    redis as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    businesses.findOne.mockResolvedValue(business);
    plans.findOne.mockResolvedValue(plan);
    transactions.save.mockImplementation(async (value) => ({ ...value, id: 'payment-1' }));
    transactions.findOne.mockResolvedValue(null);
    gateway.createPayment.mockResolvedValue({
      status: PaymentStatus.PENDING,
      transactionId: 'provider-ref',
      redirectUrl: 'https://gateway.example/pay',
    });
    redis.invalidateSubscription.mockResolvedValue(undefined);
  });

  it('does not create checkout for a business the user does not own', async () => {
    businesses.findOne.mockResolvedValue(null);

    await expect(service.startCheckout(7, {
      requestId: '8b1a9898-fc43-4c19-90c0-cd4349bf4acf',
      businessId: 'business-1',
      planId: 2,
      paymentProvider: PaymentProvider.KHALTI,
    })).rejects.toBeInstanceOf(ForbiddenException);
    expect(gateway.createPayment).not.toHaveBeenCalled();
  });

  it('charges the database price and returns the provider checkout action', async () => {
    const response = await service.startCheckout(7, {
      requestId: '8b1a9898-fc43-4c19-90c0-cd4349bf4acf',
      businessId: 'business-1',
      planId: 2,
      paymentProvider: PaymentProvider.KHALTI,
    });

    expect(gateway.createPayment).toHaveBeenCalledWith(expect.objectContaining({
      amount: 1000,
      orderId: 'payment-1',
      returnUrl: 'https://api.example.com/subscription-payments/return/khalti',
    }));
    expect(response).toMatchObject({
      paymentId: 'payment-1',
      amount: 1000,
      method: 'GET',
      redirectUrl: 'https://gateway.example/pay',
    });
  });

  it('reuses the same checkout for a retried request ID', async () => {
    transactions.findOne.mockResolvedValue({
      id: 'payment-1',
      businessId: 'business-1',
      ownerId: 7,
      requestId: '8b1a9898-fc43-4c19-90c0-cd4349bf4acf',
      planId: 2,
      provider: PaymentProvider.KHALTI,
      amount: '1000.00',
      currency: 'NPR',
      status: TransactionStatus.PENDING,
      providerTransactionId: 'provider-ref',
      checkoutUrl: 'https://gateway.example/pay',
    });

    const response = await service.startCheckout(7, {
      requestId: '8b1a9898-fc43-4c19-90c0-cd4349bf4acf',
      businessId: 'business-1',
      planId: 2,
      paymentProvider: PaymentProvider.KHALTI,
    });

    expect(response).toMatchObject({
      paymentId: 'payment-1',
      redirectUrl: 'https://gateway.example/pay',
    });
    expect(transactions.save).not.toHaveBeenCalled();
    expect(gateway.createPayment).not.toHaveBeenCalled();
  });

  it('rejects a successful provider response with the wrong amount', async () => {
    transactions.findOne.mockResolvedValue({
      id: 'payment-1',
      provider: PaymentProvider.KHALTI,
      providerTransactionId: 'provider-ref',
      amount: '1000.00',
      currency: 'NPR',
      status: TransactionStatus.PENDING,
    });
    gateway.verifyPayment.mockResolvedValue({
      status: PaymentStatus.SUCCEEDED,
      transactionId: 'provider-ref',
      amount: 1,
      currency: 'NPR',
    });

    await expect(service.confirmReference(PaymentProvider.KHALTI, 'provider-ref'))
      .rejects.toBeInstanceOf(BadGatewayException);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('applies a confirmed payment only once across repeated callbacks', async () => {
    const payment = {
      id: 'payment-1',
      provider: PaymentProvider.KHALTI,
      providerTransactionId: 'provider-ref',
      amount: '1000.00',
      currency: 'NPR',
      status: TransactionStatus.PENDING,
      businessId: 'business-1',
      ownerId: 7,
      planId: 2,
      subscriptionId: null,
    };
    transactions.findOne.mockImplementation(async () => payment);
    transactions.findOneByOrFail.mockImplementation(async () => payment);
    gateway.verifyPayment.mockResolvedValue({
      status: PaymentStatus.SUCCEEDED,
      transactionId: 'provider-ref',
      amount: 1000,
      currency: 'NPR',
    });
    const query = {
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(business),
    };
    const manager = {
      findOne: jest.fn(async (entity) => entity === PaymentTransactionEntity
        ? payment : { subscriptionId: 1, planId: 1, status: SubscriptionStatus.ACTIVE, endsAt: null }),
      findOneBy: jest.fn(async () => plan),
      getRepository: jest.fn(() => ({ createQueryBuilder: () => query })),
      create: jest.fn((_entity, value) => value),
      save: jest.fn(async (value) => ({ ...value, subscriptionId: 2 })),
      update: jest.fn(async (entity, _where, values) => {
        if (entity === PaymentTransactionEntity) Object.assign(payment, values);
      }),
    };
    dataSource.transaction.mockImplementation(async (work) => work(manager));

    await service.confirmReference(PaymentProvider.KHALTI, 'provider-ref');
    await service.confirmReference(PaymentProvider.KHALTI, 'provider-ref');

    expect(manager.save).toHaveBeenCalledTimes(1);
    expect(payment.status).toBe(TransactionStatus.SUCCEEDED);
    expect(payment.subscriptionId).toBe(2);
    expect(redis.invalidateSubscription).toHaveBeenCalledWith('business-1');
  });
});
