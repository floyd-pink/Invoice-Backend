import { IPaymentGateway } from '../interfaces/ipayment-gateway.interface';
import { PaymentProvider } from '../enums/payment-provider.enum';
import { PaymentRequest } from '../interfaces/payment-request.dto';
import { PaymentResponse } from '../interfaces/payment-response.dto';

/** Shared checks around each provider's create and status APIs. */
export abstract class BasePaymentGateway implements IPaymentGateway {
  abstract readonly provider: PaymentProvider;

  async createPayment(request: PaymentRequest): Promise<PaymentResponse> {
    if (!this.supportsCurrency(request.currency)) {
      throw new Error(`${this.provider} does not support ${request.currency}`);
    }
    return this.doCreatePayment(request);
  }

  verifyPayment(
    reference: string,
    expectedAmount: number,
  ): Promise<PaymentResponse> {
    return this.doVerifyPayment(reference, expectedAmount);
  }

  protected abstract doCreatePayment(
    request: PaymentRequest,
  ): Promise<PaymentResponse>;
  protected abstract doVerifyPayment(
    reference: string,
    expectedAmount: number,
  ): Promise<PaymentResponse>;
  abstract supportsCurrency(currency: string): boolean;
}
