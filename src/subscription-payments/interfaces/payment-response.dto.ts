export enum PaymentStatus {
  PENDING = 'PENDING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
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
}
