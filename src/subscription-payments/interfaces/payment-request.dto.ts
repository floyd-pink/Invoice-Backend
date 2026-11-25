export interface PaymentRequest {
  amount: number;
  currency: string;
  businessId: string;
  planId: number;
  orderId: string;
  customerEmail: string;
  customerName: string;
  returnUrl: string;
  cancelUrl: string;
  websiteUrl: string;
}
