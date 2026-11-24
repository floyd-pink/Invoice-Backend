import { EsewaGateway } from './esewa.gateway';
import { KhaltiGateway } from './khalti.gateway';
import { PaymentRequest } from '../interfaces/payment-request.dto';
import { PaymentStatus } from '../interfaces/payment-response.dto';
import * as crypto from 'crypto';
import { BadRequestException } from '@nestjs/common';

const request: PaymentRequest = {
  orderId: 'order-1',
  businessId: 'business-1',
  planId: 2,
  amount: 1000,
  currency: 'NPR',
  customerEmail: 'owner@example.com',
  customerName: 'Shop',
  returnUrl: 'https://api.example.com/subscription-payments/return/khalti',
  cancelUrl:
    'https://api.example.com/subscription-payments/return/esewa/failure',
  websiteUrl: 'https://shop.example.com',
};

describe('payment gateway adapters', () => {
  afterEach(() => jest.restoreAllMocks());

  it('returns eSewa form fields and verifies with the original amount', async () => {
    const config = {
      get: (key: string) =>
        ({
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
    const config = {
      get: (key: string) =>
        key === 'KHALTI_SECRET_KEY' ? 'test-key' : undefined,
    };
    const gateway = new KhaltiGateway(config as never);
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          pidx: 'pidx-1',
          payment_url: 'https://pay.example.com',
          expires_at: '2026-11-25T12:00:00+05:45',
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          pidx: 'pidx-1',
          total_amount: 100000,
          status: 'Completed',
        }),
      } as Response);

    const checkout = await gateway.createPayment(request);
    const sent = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string,
    );
    expect(sent.amount).toBe(100000);
    expect(checkout.transactionId).toBe('pidx-1');
    expect(checkout.expiresAt).toEqual(new Date('2026-11-25T12:00:00+05:45'));

    const verified = await gateway.verifyPayment('pidx-1', 1000);
    expect(verified).toMatchObject({
      status: PaymentStatus.SUCCEEDED,
      transactionId: 'pidx-1',
      amount: 1000,
    });
  });

  it('rejects a changed eSewa browser return even if it contains a valid payment ID', () => {
    const gateway = new EsewaGateway({
      get: (key: string) =>
        ({
          ESEWA_SECRET_KEY: 'test-secret',
          ESEWA_PRODUCT_CODE: 'EPAYTEST',
        })[key],
    } as never);
    const fields = {
      transaction_code: 'REF123',
      status: 'COMPLETE',
      total_amount: '1000.0',
      transaction_uuid: 'SUB-9f0b76f0-766f-45c9-89f5-2662af2f01aa',
      product_code: 'EPAYTEST',
      signed_field_names:
        'transaction_code,status,total_amount,transaction_uuid,product_code,signed_field_names',
    };
    const message = fields.signed_field_names
      .split(',')
      .map((name) => `${name}=${fields[name]}`)
      .join(',');
    const signature = crypto
      .createHmac('sha256', 'test-secret')
      .update(message)
      .digest('base64');
    const original = Buffer.from(
      JSON.stringify({ ...fields, signature }),
    ).toString('base64');
    expect(gateway.verifiedReturnReference(original)).toBe(
      fields.transaction_uuid,
    );
    const changed = Buffer.from(
      JSON.stringify({ ...fields, total_amount: '1.0', signature }),
    ).toString('base64');
    expect(() => gateway.verifiedReturnReference(changed)).toThrow(
      BadRequestException,
    );
  });

  it('keeps an ambiguous eSewa status unresolved', async () => {
    const gateway = new EsewaGateway({
      get: (key: string) =>
        ({
          ESEWA_PRODUCT_CODE: 'EPAYTEST',
        })[key],
    } as never);
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        transaction_uuid: 'SUB-order-1',
        product_code: 'EPAYTEST',
        total_amount: 1000,
        status: 'AMBIGUOUS',
      }),
    } as Response);
    const result = await gateway.verifyPayment('SUB-order-1', 1000);
    expect(result.status).toBe(PaymentStatus.UNKNOWN);
  });

  it('preserves eSewa NOT_FOUND separately from a final failure', async () => {
    const gateway = new EsewaGateway({
      get: (key: string) =>
        key === 'ESEWA_PRODUCT_CODE' ? 'EPAYTEST' : undefined,
    } as never);
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        transaction_uuid: 'SUB-order-1',
        product_code: 'EPAYTEST',
        total_amount: 1000,
        status: 'NOT_FOUND',
      }),
    } as Response);

    const result = await gateway.verifyPayment('SUB-order-1', 1000);

    expect(result.status).toBe(PaymentStatus.NOT_FOUND);
  });
});
