export interface PaymentRequest {
  amount: number;
  currency: string;
  businessId: string;
  subscriptionId?: number;
  planId: number;
  billingCycle: string;
  customerId: string;
  customerEmail: string;
  customerName: string;
  returnUrl?: string;
  cancelUrl?: string;
}
