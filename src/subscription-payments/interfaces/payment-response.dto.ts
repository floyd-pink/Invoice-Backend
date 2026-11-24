export enum PaymentStatus {
  PENDING = 'PENDING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
  PARTIALLY_REFUNDED = 'PARTIALLY_REFUNDED',
  NOT_FOUND = 'NOT_FOUND',
  UNKNOWN = 'UNKNOWN',
}
export interface PaymentResponse {
  status: PaymentStatus;
  transactionId: string;
  gatewayReference?: string;
  amount: number;
  currency: string;
  rawResponse?: Record<string, any>; //helps to handel the response from different payment providers
  nextAction?: 'REDIRECT' | 'POLL' | 'WEBHOOK';
  redirectUrl?: string;
  formFields?: Record<string, string>;
  expiresAt?: Date;
}
