import { Injectable } from '@nestjs/common';
import { PaymentProvider } from '../enums/payment-provider.enum';
import { BasePaymentGateway } from './payment-gateway.abstract';
import { PaymentRequest, PaymentResponse, PaymentStatus } from '../interfaces';
import {
  BadGatewayException,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class KhaltiGateway extends BasePaymentGateway {
  readonly provider = PaymentProvider.KHALTI;

  constructor(private readonly config: ConfigService) {
    super();
  }

  private get baseUrl(): string {
    const configured = this.config.get<string>('KHALTI_BASE_URL');
    if (!configured && this.config.get<string>('NODE_ENV') === 'production') {
      throw new InternalServerErrorException(
        'KHALTI_BASE_URL is required in production',
      );
    }
    const value = (configured || 'https://dev.khalti.com/api/v2').replace(
      /\/$/,
      '',
    );
    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      throw new InternalServerErrorException('KHALTI_BASE_URL is invalid');
    }
    if (
      this.config.get<string>('NODE_ENV') === 'production' &&
      parsed.protocol !== 'https:'
    ) {
      throw new InternalServerErrorException('KHALTI_BASE_URL must use HTTPS');
    }
    return value;
  }

  private get secretKey(): string {
    const key = this.config.get<string>('KHALTI_SECRET_KEY');
    if (!key)
      throw new InternalServerErrorException(
        'Khalti credentials are not configured',
      );
    return key;
  }

  protected async doCreatePayment(
    request: PaymentRequest,
  ): Promise<PaymentResponse> {
    const purchaseOrderId = `SUB-${request.orderId}`;
    const payload = {
      return_url: request.returnUrl,
      website_url: request.websiteUrl,
      amount: Math.round(request.amount * 100), // Convert to paisa
      purchase_order_id: purchaseOrderId,
      purchase_order_name: `Plan ${request.planId}`,
      customer_info: {
        name: request.customerName,
        email: request.customerEmail,
      },
    };
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/epayment/initiate/`, {
        method: 'POST',
        signal: AbortSignal.timeout(10_000),
        headers: {
          Authorization: `Key ${this.secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    } catch {
      throw new ServiceUnavailableException(
        'Khalti initiation is temporarily unavailable',
      );
    }
    let data: Record<string, unknown>;
    try {
      const parsed: unknown = await response.json();
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Invalid response');
      }
      data = parsed as Record<string, unknown>;
    } catch {
      throw new BadGatewayException(
        'Khalti returned an invalid initiation response',
      );
    }

    if (
      !response.ok ||
      typeof data.payment_url !== 'string' ||
      typeof data.pidx !== 'string'
    ) {
      throw new BadGatewayException('Khalti could not start the payment');
    }
    let paymentUrl: URL;
    try {
      paymentUrl = new URL(data.payment_url);
    } catch {
      throw new BadGatewayException('Khalti returned an invalid payment URL');
    }
    if (paymentUrl.protocol !== 'https:') {
      throw new BadGatewayException('Khalti returned an insecure payment URL');
    }

    const expiry = data.expires_at;
    const expiresAt = typeof expiry === 'string' ? new Date(expiry) : undefined;
    if (expiresAt && Number.isNaN(expiresAt.getTime())) {
      throw new BadGatewayException('Khalti returned an invalid expiry time');
    }

    return {
      status: PaymentStatus.PENDING,
      transactionId: data.pidx, // Khalti uses pidx as the main reference
      gatewayReference: data.pidx,
      amount: request.amount,
      currency: request.currency.toUpperCase(),
      nextAction: 'REDIRECT',
      redirectUrl: data.payment_url,
      rawResponse: data,
      expiresAt,
    };
  }

  protected async doVerifyPayment(
    transactionId: string,
  ): Promise<PaymentResponse> {
    // transactionId here is the pidx
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/epayment/lookup/`, {
        method: 'POST',
        signal: AbortSignal.timeout(10_000),
        headers: {
          Authorization: `Key ${this.secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ pidx: transactionId }),
      });
    } catch {
      throw new ServiceUnavailableException(
        'Khalti lookup is temporarily unavailable',
      );
    }
    let data: Record<string, unknown>;
    try {
      const parsed: unknown = await response.json();
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Invalid response');
      }
      data = parsed as Record<string, unknown>;
    } catch {
      throw new BadGatewayException(
        'Khalti returned an invalid lookup response',
      );
    }
    if (typeof data.pidx !== 'string' || typeof data.status !== 'string') {
      throw new BadGatewayException(
        'Khalti returned an invalid lookup response',
      );
    }
    // Khalti can return HTTP 400 for an expired or cancelled payment.
    if (!response.ok && !['Expired', 'User canceled'].includes(data.status)) {
      throw new ServiceUnavailableException(
        `Khalti lookup failed (${response.status})`,
      );
    }

    const statusMap: Record<string, PaymentStatus> = {
      Completed: PaymentStatus.SUCCEEDED,
      Pending: PaymentStatus.PENDING,
      Initiated: PaymentStatus.PENDING,
      Expired: PaymentStatus.FAILED,
      'User canceled': PaymentStatus.CANCELLED,
      Refunded: PaymentStatus.REFUNDED,
      'Partially Refunded': PaymentStatus.PARTIALLY_REFUNDED,
      'Partially refunded': PaymentStatus.PARTIALLY_REFUNDED,
    };

    return {
      status: statusMap[data.status] ?? PaymentStatus.UNKNOWN,
      transactionId: data.pidx,
      gatewayReference:
        typeof data.transaction_id === 'string'
          ? data.transaction_id
          : undefined,
      amount: Number(data.total_amount ?? 0) / 100, // Convert paisa to main unit
      currency: 'NPR',
      rawResponse: data,
    };
  }

  supportsCurrency(currency: string): boolean {
    return currency.toUpperCase() === 'NPR';
  }
}
