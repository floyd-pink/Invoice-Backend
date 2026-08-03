import { IsEnum, IsNotEmpty, IsString, IsNumber } from 'class-validator';
import { PaymentMethod } from '../entities/invoicePayments.entity';

export class ReceivePaymentDto {
  @IsNotEmpty()
  @IsNumber()
  payment_amount: number;

  @IsNotEmpty()
  @IsEnum(PaymentMethod, {
    message: 'payment method does not match allowed methods',
  })
  payment_method: PaymentMethod;

  @IsNotEmpty()
  @IsString()
  payment_reference: string;
}
