import { PaymentReconciliationService } from './payment-reconciliation.service';
import { PaymentProvider } from './enums/payment-provider.enum';
import { TransactionStatus } from './entities/payment-transaction.entity';
import {
  BusinessSubscriptionEntity,
  SubscriptionStatus,
} from 'src/business-subscription/entities/business-subscription.entity';
import { BusinessEntity } from 'src/bussiness/entities/bussiness.entity';

describe('PaymentReconciliationService', () => {
  const dataSource = {
    query: jest.fn(),
    getRepository: jest.fn(() => ({ find: jest.fn().mockResolvedValue([]) })),
  };
  const payments = { findOneBy: jest.fn(), update: jest.fn() };
  const subscriptions = { confirmReference: jest.fn() };
  const worker = new PaymentReconciliationService(
    dataSource as never,
    payments as never,
    subscriptions as never,
    { validate: jest.fn() } as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    dataSource.query.mockResolvedValue([
      [{ id: 'payment-1', check_attempts: 1 }],
      1,
    ]);
    dataSource.getRepository.mockImplementation(() => ({
      find: jest.fn().mockResolvedValue([]),
    }));
    subscriptions.confirmReference.mockResolvedValue({
      paymentId: 'payment-1',
      status: 'SUCCEEDED',
    });
  });

  it('verifies a payment whose browser return never reached the backend', async () => {
    payments.findOneBy.mockResolvedValue({
      id: 'payment-1',
      provider: PaymentProvider.KHALTI,
      providerTransactionId: 'khalti-pidx',
      status: TransactionStatus.PENDING,
    });
    await worker.runOnce();
    expect(payments.findOneBy).toHaveBeenCalledWith({ id: 'payment-1' });
    expect(subscriptions.confirmReference).toHaveBeenCalledWith(
      PaymentProvider.KHALTI,
      'khalti-pidx',
    );
  });

  it('continues checking other payments when one claimed row fails', async () => {
    dataSource.query.mockResolvedValue([
      [
        { id: 'payment-broken', check_attempts: 1 },
        { id: 'payment-healthy', check_attempts: 1 },
      ],
      2,
    ]);
    payments.findOneBy.mockImplementation(async ({ id }) => {
      if (id === 'payment-broken') throw new Error('Temporary database error');
      return {
        id,
        provider: PaymentProvider.KHALTI,
        providerTransactionId: 'healthy-pidx',
        status: TransactionStatus.PENDING,
      };
    });

    await worker.runOnce();

    expect(subscriptions.confirmReference).toHaveBeenCalledWith(
      PaymentProvider.KHALTI,
      'healthy-pidx',
    );
  });

  it('does not blindly create a second Khalti checkout without pidx', async () => {
    payments.findOneBy.mockResolvedValue({
      id: 'payment-1',
      provider: PaymentProvider.KHALTI,
      providerTransactionId: null,
      status: TransactionStatus.NEEDS_REVIEW,
    });
    await worker.runOnce();
    expect(subscriptions.confirmReference).not.toHaveBeenCalled();
    expect(payments.update).toHaveBeenCalledWith(
      'payment-1',
      expect.objectContaining({ status: TransactionStatus.ERROR }),
    );
  });

  it('restricts an additional business when its paid period expires', async () => {
    dataSource.query.mockResolvedValue([[], 0]);
    dataSource.getRepository.mockImplementation(() => ({
      find: jest.fn().mockResolvedValue([
        {
          subscriptionId: 12,
          businessId: 'business-1',
        },
      ]),
    }));
    const manager = {
      findOne: jest.fn(async (entity) =>
        entity === BusinessEntity
          ? { business_id: 'business-1', requiresPaidSubscription: true }
          : {
              subscriptionId: 12,
              status: SubscriptionStatus.ACTIVE,
              endsAt: new Date('2020-01-01'),
            },
      ),
      update: jest.fn(),
    };
    (dataSource as any).transaction = jest.fn(async (work) => work(manager));
    await worker.runOnce();
    expect(manager.update).toHaveBeenCalledWith(
      BusinessSubscriptionEntity,
      12,
      { status: SubscriptionStatus.EXPIRED },
    );
    expect(manager.update).toHaveBeenCalledWith(BusinessEntity, 'business-1', {
      isActive: false,
    });
  });

  it('refuses to start recovery before the payment migration is present', async () => {
    dataSource.query.mockRejectedValue(
      new Error('column next_check_at does not exist'),
    );
    await expect(worker.onModuleInit()).rejects.toThrow('next_check_at');
  });
});
