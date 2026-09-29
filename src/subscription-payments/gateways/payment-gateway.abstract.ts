import { IPaymentGateway } from '../interfaces/ipayment-gateway.interface';
import { PaymentProvider } from '../enums/payment-provider.enum';
import { PaymentRequest } from '../interfaces/payment-request.dto';
import {
  PaymentResponse,
  PaymentStatus,
} from '../interfaces/payment-response.dto';
/**
 * BasePaymentGateway — Template Method implementation.
 *
 * Every concrete gateway extends this class and implements only the
 * three primitive methods: doCreatePayment, doVerifyPayment, doHandleWebhook.
 *
 * Shared behavior (currency validation, response normalization) lives here
 * so it cannot be accidentally omitted or inconsistently implemented.
 */
export abstract class BasePaymentGateway implements IPaymentGateway {
  /** Each subclass declares its provider identity */
  abstract readonly provider: PaymentProvider;

  /**
   * Template Method: createPayment
   * 1. Pre-flight: assert currency is supported
   * 2. Delegate: subclass does the actual API work
   * 3. Normalize: convert provider-specific response to PaymentResponse
   */
  async createPayment(request: PaymentRequest): Promise<PaymentResponse> {
    this.assertCurrencySupported(request.currency);
    const raw = await this.doCreatePayment(request);
    return this.normalizeResponse(raw);
  }

  async verifyPayment(transactionId: string): Promise<PaymentResponse> {
    const raw = await this.doVerifyPayment(transactionId);
    return this.normalizeResponse(raw);
  }

  async handleWebhook(payload: unknown): Promise<PaymentResponse> {
    const raw = await this.doHandleWebhook(payload);
    return this.normalizeResponse(raw);
  }

  /* ------------------------------------------------------------------ */
  /*  Primitives — subclasses MUST implement these                      */
  /* ------------------------------------------------------------------ */

  protected abstract doCreatePayment(
    request: PaymentRequest,
  ): Promise<PaymentResponse>;
  protected abstract doVerifyPayment(
    transactionId: string,
  ): Promise<PaymentResponse>;
  protected abstract doHandleWebhook(
    payload: unknown,
  ): Promise<PaymentResponse>;

  /* ------------------------------------------------------------------ */
  /*  Shared helpers                                                    */
  /* ------------------------------------------------------------------ */

  /**
   * Fail-fast guard. Called before any provider API call.
   * Prevents confusing provider-level errors for unsupported currencies.
   */
  protected assertCurrencySupported(currency: string): void {
    if (!this.supportsCurrency(currency)) {
      throw new Error(
        `Provider ${this.provider} does not support currency: ${currency}. ` +
          `Supported currencies: ${this.getSupportedCurrencies().join(', ')}`,
      );
    }
  }

  /**
   * Each provider declares its own currency allowlist.
   * This is the single source of truth for what that provider accepts.
   */
  abstract supportsCurrency(currency: string): boolean;

  /**
   * Helper to return all supported currencies as an array.
   * Used in the error message above. Subclasses can override if needed.
   */
  protected getSupportedCurrencies(): string[] {
    // Default implementation — subclasses with many currencies should override
    return ['USD'];
  }

  /**
   * normalizeResponse converts a provider-specific partial response
   * into the canonical PaymentResponse shape.
   *
   * Why private? Because normalization logic is identical for all
   * subclasses and should not be overridden. If a provider needs
   * custom normalization, it normalizes inside its own doXxx method
   * before returning.
   */
  private normalizeResponse(raw: Partial<PaymentResponse>): PaymentResponse {
    return {
      status: raw.status ?? PaymentStatus.PENDING,
      transactionId: raw.transactionId ?? '',
      gatewayReference: raw.gatewayReference,
      amount: raw.amount ?? 0,
      currency: raw.currency?.toUpperCase() ?? '',
      rawResponse: raw.rawResponse,
      nextAction: raw.nextAction,
      redirectUrl: raw.redirectUrl,
    };
  }
}
