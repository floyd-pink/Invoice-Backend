import { PaymentResponse } from './payment-response.dto';
import { PaymentRequest } from './payment-request.dto';
import { PaymentProvider } from '../enums/payment-provider.enum';

export abstract class IPaymentGateway {
  /** Must match the PaymentProvider enum value exactly */
  abstract readonly provider: PaymentProvider;

  /** Start a new payment — returns redirect URL or polling reference */
  abstract createPayment(request: PaymentRequest): Promise<PaymentResponse>;

  /** Re-query the provider for the final status of an existing transaction */
  abstract verifyPayment(transactionId: string): Promise<PaymentResponse>;

  /** Process an incoming webhook from the provider */
  abstract handleWebhook(payload: unknown): Promise<PaymentResponse>;

  /** Refund a completed payment (optional — not all providers support) */
  abstract refund?(
    transactionId: string,
    amount: number,
    reason?: string,
  ): Promise<PaymentResponse>;

  /** Pre-flight check — prevents creating a payment with unsupported currency */
  abstract supportsCurrency(currency: string): boolean;
}
