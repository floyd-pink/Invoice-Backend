import { EsewaGateway } from './esewa.gateway';
import { KhaltiGateway } from './khalti.gateway';
import { PaymentRequest } from '../interfaces/payment-request.dto';
import { PaymentStatus } from '../interfaces/payment-response.dto';

const request: PaymentRequest = {
  orderId: 'order-1',
  businessId: 'business-1',
  planId: 2,
  amount: 1000,
  currency: 'NPR',
  customerEmail: 'owner@example.com',
  customerName: 'Shop',
  returnUrl: 'https://api.example.com/subscription-payments/return/khalti',
  cancelUrl: 'https://api.example.com/subscription-payments/return/esewa/failure',
  websiteUrl: 'https://shop.example.com',
};

describe('payment gateway adapters', () => {
  afterEach(() => jest.restoreAllMocks());

  it('returns eSewa form fields and verifies with the original amount', async () => {
    const config = {
      get: (key: string) => ({
        ESEWA_SECRET_KEY: 'test-secret',
        ESEWA_PRODUCT_CODE: 'EPAYTEST',
      })[key],
    };
    const gateway = new EsewaGateway(config as never);
    const checkout = await gateway.createPayment(request);

    expect(checkout.formFields).toMatchObject({
      transaction_uuid: 'SUB-order-1',
      total_amount: '1000.00',
      product_code: 'EPAYTEST',
    });
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        transaction_uuid: 'SUB-order-1',
        product_code: 'EPAYTEST',
        total_amount: 1000,
        status: 'COMPLETE',
      }),
    } as Response);
    const result = await gateway.verifyPayment('SUB-order-1', 1000);

    expect(fetchMock.mock.calls[0][0]).toContain('total_amount=1000.00');
    expect(result.status).toBe(PaymentStatus.SUCCEEDED);
    expect(result.amount).toBe(1000);
  });

  it('sends paisa to Khalti and verifies the returned pidx', async () => {
    const config = { get: (key: string) => key === 'KHALTI_SECRET_KEY' ? 'test-key' : undefined };
    const gateway = new KhaltiGateway(config as never);
    const fetchMock = jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ pidx: 'pidx-1', payment_url: 'https://pay.example.com' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ pidx: 'pidx-1', total_amount: 100000, status: 'Completed' }),
      } as Response);

    const checkout = await gateway.createPayment(request);
    const sent = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(sent.amount).toBe(100000);
    expect(checkout.transactionId).toBe('pidx-1');

    const verified = await gateway.verifyPayment('pidx-1', 1000);
    expect(verified).toMatchObject({
      status: PaymentStatus.SUCCEEDED,
      transactionId: 'pidx-1',
      amount: 1000,
    });
  });
});
