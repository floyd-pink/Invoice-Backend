import {
  IsEnum,
  IsInt,
  IsUUID,
  Min,
} from 'class-validator';
import { PaymentProvider } from '../enums/payment-provider.enum';

export class InitiateSubscriptionPaymentDto {
  // Reuse the same UUID if the checkout request is retried.
  @IsUUID()
  requestId: string;

  @IsUUID()
  businessId: string;

  @IsInt()
  @Min(1)
  planId: number;

  @IsEnum(PaymentProvider, {
    message: 'paymentProvider must be a valid provider',
  })
  paymentProvider: PaymentProvider;
}
