import { Injectable } from '@nestjs/common';
import { PaymentProvider } from '../enums/payment-provider.enum';
import { BasePaymentGateway } from './payment-gateway.abstract';
import { PaymentRequest } from '../interfaces/payment-request.dto';
import {
  PaymentResponse,
  PaymentStatus,
} from '../interfaces/payment-response.dto';
import * as crypto from 'crypto';
@Injectable()
export class EsewaGateway extends BasePaymentGateway {
  readonly provider = PaymentProvider.ESEWA;

  private readonly baseurl =
    process.env.ESEWA_BASE_URL || 'https://rc.esewa.com.np';
  protected async doCreatePayment(
    request: PaymentRequest,
  ): Promise<PaymentResponse> {
    const transactionUuid = `SUB-${request.businessId}-${Date.now()}`;

    const secretKey = process.env.ESEWA_SECRET_KEY || '';
    const productCode = process.env.ESEWA_PRODUCT_CODE || '';
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
      success_url: request.returnUrl || '',
      failure_url: request.cancelUrl || '',
    };
    return {
      status: PaymentStatus.PENDING,
      transactionId: transactionUuid,
      amount: request.amount,
      currency: request.currency.toUpperCase(),
      nextAction: 'REDIRECT',
      redirectUrl: `${this.baseurl}/api/epay/main/v2/form`,
      rawResponse: formFields,
    };
  }

  protected async doVerifyPayment(
    transactionId: string,
  ): Promise<PaymentResponse> {
    const productCode = process.env.ESEWA_PRODUCT_CODE || '';
    const url = new URL(`${this.baseurl}/api/epay/transaction/status/`);
    url.searchParams.set('transaction_uuid', transactionId);
    url.searchParams.set('product_code', productCode);
    url.searchParams.set('total_amount', '0'); // Amount is not required for verification

    const response = await fetch(url.toString());
    if (!response.ok) {
      return {
        status: PaymentStatus.FAILED,
        transactionId,
        amount: 0,
        currency: 'NPR',
        rawResponse: { error: `HTTP ${response.status}` },
      };
    }
    const data = await response.json(); //this is the response from api call to esewa

    const statusMap: Record<string, PaymentStatus> = {
      COMPLETE: PaymentStatus.SUCCEEDED,
      PENDING: PaymentStatus.PENDING,
      CANCELED: PaymentStatus.CANCELLED,
      NOT_FOUND: PaymentStatus.FAILED,
      FULL_REFUND: PaymentStatus.REFUNDED,
      PARTIAL_REFUND: PaymentStatus.REFUNDED,
      AMBIGUOUS: PaymentStatus.FAILED,
    };
    return {
      status: statusMap[data.status] || PaymentStatus.FAILED,
      transactionId,
      gatewayReference: data.ref_id,
      amount: parseFloat(data.total_amount ?? '0'),
      currency: 'NPR',
      rawResponse: data,
    };
  }

  protected async doHandleWebhook(payload: unknown): Promise<PaymentResponse> {
    // The payload from success_url redirect is base64-encoded JSON string
    const encoded = payload as string;

    let decoded: Record<string, any>;
    try {
      decoded = JSON.parse(Buffer.from(encoded, 'base64').toString('utf-8'));
    } catch {
      return {
        status: PaymentStatus.FAILED,
        transactionId: '',
        amount: 0,
        currency: 'NPR',
        rawResponse: { error: 'Invalid base64 payload' },
      };
    }

    // Verify signature on the response payload
    const secretKey = process.env.ESEWA_SECRET_KEY || '';
    const signedFields: string[] = decoded.signed_field_names.split(',');
    const message = signedFields.map((f) => `${f}=${decoded[f]}`).join(',');

    const expectedSignature = crypto
      .createHmac('sha256', secretKey)
      .update(message)
      .digest('base64'); // docs specify base64 output

    if (expectedSignature !== decoded.signature) {
      return {
        status: PaymentStatus.FAILED,
        transactionId: decoded.transaction_uuid,
        amount: 0,
        currency: 'NPR',
        rawResponse: { error: 'Signature mismatch', decoded },
      };
    }

    const statusMap: Record<string, PaymentStatus> = {
      COMPLETE: PaymentStatus.SUCCEEDED,
      PENDING: PaymentStatus.PENDING,
      CANCELED: PaymentStatus.CANCELLED,
      NOT_FOUND: PaymentStatus.FAILED,
      FULL_REFUND: PaymentStatus.REFUNDED,
      PARTIAL_REFUND: PaymentStatus.REFUNDED,
      AMBIGUOUS: PaymentStatus.FAILED,
    };

    return {
      status: statusMap[decoded.status] ?? PaymentStatus.FAILED,
      transactionId: decoded.transaction_uuid,
      gatewayReference: decoded.transaction_code,
      amount: parseFloat(decoded.total_amount ?? '0'),
      currency: 'NPR',
      rawResponse: decoded,
    };
  }

  supportsCurrency(currency: string): boolean {
    return currency.toUpperCase() === 'NPR';
  }

  protected override getSupportedCurrencies(): string[] {
    return ['NPR'];
  }
}
