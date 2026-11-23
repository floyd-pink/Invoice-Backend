import { Injectable } from '@nestjs/common';
import { PaymentProvider } from '../enums/payment-provider.enum';
import { BasePaymentGateway } from './payment-gateway.abstract';
import { PaymentRequest } from '../interfaces/payment-request.dto';
import {
  PaymentResponse,
  PaymentStatus,
} from '../interfaces/payment-response.dto';
import * as crypto from 'crypto';
import {
  BadGatewayException,
  BadRequestException,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
@Injectable()
export class EsewaGateway extends BasePaymentGateway {
  readonly provider = PaymentProvider.ESEWA;

  constructor(private readonly config: ConfigService) {
    super();
  }

  /** Check eSewa's signed browser return before using its transaction UUID. */
  verifiedReturnReference(encoded: string): string {
    let data: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(
        Buffer.from(encoded, 'base64').toString('utf8'),
      );
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Invalid response');
      }
      data = parsed as Record<string, unknown>;
    } catch {
      throw new BadRequestException('Invalid eSewa response');
    }
    const names = data?.signed_field_names;
    const signature = data?.signature;
    const secret = this.config.get<string>('ESEWA_SECRET_KEY');
    const productCode = this.config.get<string>('ESEWA_PRODUCT_CODE');
    if (!secret || !productCode) {
      throw new InternalServerErrorException(
        'eSewa credentials are not configured',
      );
    }
    if (
      typeof names !== 'string' ||
      typeof signature !== 'string' ||
      typeof data.transaction_uuid !== 'string' ||
      !/^SUB-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        data.transaction_uuid,
      ) ||
      data.product_code !== productCode
    ) {
      throw new BadRequestException('Invalid eSewa response');
    }
    const fields = names.split(',');
    if (
      new Set(fields).size !== fields.length ||
      !['transaction_uuid', 'product_code', 'total_amount', 'status'].every(
        (name) => fields.includes(name),
      ) ||
      fields.some(
        (name) =>
          !/^[a-z_]+$/.test(name) ||
          (typeof data[name] !== 'string' && typeof data[name] !== 'number'),
      )
    ) {
      throw new BadRequestException('Invalid eSewa signed fields');
    }
    const message = fields
      .map((name) => `${name}=${String(data[name])}`)
      .join(',');
    const expected = crypto
      .createHmac('sha256', secret)
      .update(message)
      .digest();
    const received = Buffer.from(signature, 'base64');
    if (
      received.length !== expected.length ||
      !crypto.timingSafeEqual(received, expected)
    ) {
      throw new BadRequestException('Invalid eSewa signature');
    }
    return data.transaction_uuid;
  }

  private get formBaseUrl(): string {
    return this.providerUrl('ESEWA_FORM_BASE_URL');
  }

  private get statusBaseUrl(): string {
    return this.providerUrl('ESEWA_STATUS_BASE_URL');
  }

  private providerUrl(key: string): string {
    const configured = this.config.get<string>(key);
    if (!configured && this.config.get<string>('NODE_ENV') === 'production') {
      throw new InternalServerErrorException(
        `${key} is required in production`,
      );
    }
    const value = (
      configured ||
      this.config.get<string>('ESEWA_BASE_URL') ||
      'https://rc.esewa.com.np'
    ).replace(/\/$/, '');
    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      throw new InternalServerErrorException(`${key} is invalid`);
    }
    if (
      this.config.get<string>('NODE_ENV') === 'production' &&
      parsed.protocol !== 'https:'
    ) {
      throw new InternalServerErrorException(`${key} must use HTTPS`);
    }
    return value;
  }

  protected doCreatePayment(request: PaymentRequest): Promise<PaymentResponse> {
    const transactionUuid = `SUB-${request.orderId}`;

    const secretKey = this.config.get<string>('ESEWA_SECRET_KEY');
    const productCode = this.config.get<string>('ESEWA_PRODUCT_CODE');
    if (!secretKey || !productCode) {
      throw new InternalServerErrorException(
        'eSewa credentials are not configured',
      );
    }
    const totalAmount = request.amount.toFixed(2);

    const message = `total_amount=${totalAmount},transaction_uuid=${transactionUuid},product_code=${productCode}`;

    const signature = crypto
      .createHmac('sha256', secretKey)
      .update(message)
      .digest('base64');

    const formFields = {
      amount: totalAmount,
      tax_amount: '0',
      total_amount: totalAmount,
      product_code: productCode,
      product_service_charge: '0',
      product_delivery_charge: '0',
      transaction_uuid: transactionUuid,
      signature,
      signed_field_names: 'total_amount,transaction_uuid,product_code',
      success_url: request.returnUrl,
      failure_url: request.cancelUrl,
    };
    return Promise.resolve({
      status: PaymentStatus.PENDING,
      transactionId: transactionUuid,
      amount: request.amount,
      currency: request.currency.toUpperCase(),
      nextAction: 'REDIRECT',
      redirectUrl: `${this.formBaseUrl}/api/epay/main/v2/form`,
      formFields,
      rawResponse: formFields,
    });
  }

  protected async doVerifyPayment(
    transactionId: string,
    expectedAmount: number,
  ): Promise<PaymentResponse> {
    const productCode = this.config.get<string>('ESEWA_PRODUCT_CODE');
    if (!productCode)
      throw new InternalServerErrorException(
        'eSewa product code is not configured',
      );
    const url = new URL(`${this.statusBaseUrl}/api/epay/transaction/status/`);
    url.searchParams.set('transaction_uuid', transactionId);
    url.searchParams.set('product_code', productCode);
    url.searchParams.set('total_amount', expectedAmount.toFixed(2));

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new ServiceUnavailableException(
        'eSewa status is temporarily unavailable',
      );
    }
    if (!response.ok)
      throw new ServiceUnavailableException(
        `eSewa status check failed (${response.status})`,
      );
    let data: Record<string, unknown>;
    try {
      const parsed: unknown = await response.json();
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Invalid response');
      }
      data = parsed as Record<string, unknown>;
    } catch {
      throw new BadGatewayException(
        'eSewa returned an invalid status response',
      );
    }
    if (
      data.transaction_uuid !== transactionId ||
      data.product_code !== productCode
    ) {
      throw new BadGatewayException('eSewa returned a different transaction');
    }

    const statusMap: Record<string, PaymentStatus> = {
      COMPLETE: PaymentStatus.SUCCEEDED,
      PENDING: PaymentStatus.PENDING,
      CANCELED: PaymentStatus.CANCELLED,
      NOT_FOUND: PaymentStatus.FAILED,
      FULL_REFUND: PaymentStatus.REFUNDED,
      PARTIAL_REFUND: PaymentStatus.PARTIALLY_REFUNDED,
      AMBIGUOUS: PaymentStatus.UNKNOWN,
    };
    const rawAmount = data.total_amount;
    const amount =
      typeof rawAmount === 'string' || typeof rawAmount === 'number'
        ? Number(String(rawAmount).replace(/,/g, ''))
        : Number.NaN;
    return {
      status:
        typeof data.status === 'string'
          ? statusMap[data.status] || PaymentStatus.UNKNOWN
          : PaymentStatus.UNKNOWN,
      transactionId,
      gatewayReference:
        typeof data.ref_id === 'string' ? data.ref_id : undefined,
      amount,
      currency: 'NPR',
      rawResponse: data,
    };
  }

  supportsCurrency(currency: string): boolean {
    return currency.toUpperCase() === 'NPR';
  }
}
