import { PaymentProvider } from '../enums/payment-provider.enum';
import { PaymentRequest } from './payment-request.dto';
import { PaymentResponse } from './payment-response.dto';

/** The subscription service uses this contract without knowing provider details. */
export abstract class IPaymentGateway {
  abstract readonly provider: PaymentProvider;
  abstract createPayment(request: PaymentRequest): Promise<PaymentResponse>;
  abstract verifyPayment(
    reference: string,
    expectedAmount: number,
  ): Promise<PaymentResponse>;
  abstract supportsCurrency(currency: string): boolean;
}
