import { Injectable } from '@nestjs/common';
import { PaymentProvider } from '../enums/payment-provider.enum';
import { BasePaymentGateway } from './payment-gateway.abstract';
import { PaymentRequest, PaymentResponse, PaymentStatus } from '../interfaces';

@Injectable()
export class KhaltiGateway extends BasePaymentGateway {
  readonly provider = PaymentProvider.KHALTI;

  private readonly baseUrl =
    process.env.KHALTI_BASE_URL || 'https://dev.khalti.com/api/v2';

  protected async doCreatePayment(
    request: PaymentRequest,
  ): Promise<PaymentResponse> {
    const purchaseOrderId = `SUB-${request.businessId}-${Date.now()}`;
    const payload = {
      return_url: request.returnUrl || '',
      website_url: process.env.KHALTI_WEBSITE_URL || 'http://localhost:3000',
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
        Authorization: `Key ${process.env.KHALTI_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok || data.payment_url === undefined) {
      return {
        status: PaymentStatus.FAILED,
        transactionId: purchaseOrderId,
        amount: request.amount,
        currency: request.currency,
        rawResponse: data,
      };
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
  ): Promise<PaymentResponse> {
    // transactionId here is the pidx
    const response = await fetch(`${this.baseUrl}/epayment/lookup/`, {
      method: 'POST',
      headers: {
        Authorization: `Key ${process.env.KHALTI_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pidx: transactionId,
      }),
    });

    const data = await response.json();

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

  protected async doHandleWebhook(payload: unknown): Promise<PaymentResponse> {
    // Khalti doesn't have webhooks - they use redirect callbacks
    // This method is called from our success endpoint when Khalti redirects back
    const params = payload as Record<string, string>;

    return {
      status:
        params.status === 'Completed'
          ? PaymentStatus.SUCCEEDED
          : PaymentStatus.FAILED,
      transactionId: params.pidx,
      gatewayReference: params.transaction_id,
      amount: parseFloat(params.amount ?? '0') / 100,
      currency: 'NPR',
      rawResponse: params,
    };
  }

  supportsCurrency(currency: string): boolean {
    return currency.toUpperCase() === 'NPR';
  }

  protected override getSupportedCurrencies(): string[] {
    return ['NPR'];
  }
}
