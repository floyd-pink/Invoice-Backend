import { Injectable } from '@nestjs/common';
import { PaymentProvider } from '../enums/payment-provider.enum';
import { BasePaymentGateway } from './payment-gateway.abstract';
import { PaymentRequest, PaymentResponse, PaymentStatus } from '../interfaces';
import {
  BadGatewayException,
  InternalServerErrorException,
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
    return (configured || 'https://dev.khalti.com/api/v2').replace(/\/$/, '');
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
    const response = await fetch(`${this.baseUrl}/epayment/initiate/`, {
      method: 'POST',
      headers: {
        Authorization: `Key ${this.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok || !data.payment_url || !data.pidx) {
      throw new BadGatewayException('Khalti could not start the payment');
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
    };
  }

  protected async doVerifyPayment(
    transactionId: string,
    _expectedAmount: number,
  ): Promise<PaymentResponse> {
    // transactionId here is the pidx
    const response = await fetch(`${this.baseUrl}/epayment/lookup/`, {
      method: 'POST',
      headers: {
        Authorization: `Key ${this.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pidx: transactionId,
      }),
    });

    const data = await response.json();
    // Khalti can return HTTP 400 for an expired or cancelled payment.
    if (!response.ok && !['Expired', 'User canceled'].includes(data.status)) {
      throw new BadGatewayException(
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
      'Partially Refunded': PaymentStatus.REFUNDED,
    };

    return {
      status: statusMap[data.status] ?? PaymentStatus.FAILED,
      transactionId: data.pidx,
      gatewayReference: data.transaction_id,
      amount: (data.total_amount ?? 0) / 100, // Convert paisa to main unit
      currency: 'NPR',
      rawResponse: data,
    };
  }

  supportsCurrency(currency: string): boolean {
    return currency.toUpperCase() === 'NPR';
  }
}
