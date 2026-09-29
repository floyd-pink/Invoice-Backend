import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsUUID,
  Min,
  IsString,
  IsEmail,
} from 'class-validator';
import { PaymentProvider } from '../enums/payment-provider.enum';

export class InitiateSubscriptionPaymentDto {
  //this is HTTP contract
  @IsUUID()
  businessId: string;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsString()
  currency: string;

  @IsNumber()
  planId: number;

  @IsUUID()
  customerId: string;

  @IsEmail()
  customerEmail: string;

  @IsString()
  customerName: string;

  @IsEnum(PaymentProvider, {
    message: 'paymentProvider must be a valid provider',
  })
  paymentProvider: PaymentProvider;

  @IsOptional()
  @IsString()
  returnUrl?: string;

  @IsOptional()
  @IsString()
  cancelUrl?: string;

  @IsOptional()
  subscriptionId?: number;
}
