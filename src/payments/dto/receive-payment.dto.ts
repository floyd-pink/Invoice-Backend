import { IsEnum, IsNotEmpty, IsNumber, IsString } from 'class-validator';
import { PaymentMethod } from '../entities/invoicePayments.entity';
import { ApiProperty } from '@nestjs/swagger';

export class ReceivePaymentDto {
  @ApiProperty({ example: 100.00, description: 'Payment amount' })
  @IsNotEmpty()
  @IsNumber()
  payment_amount: number;

  @ApiProperty({
    enum: PaymentMethod,
    example: PaymentMethod.CASH,
    description: 'Payment method',
  })
  @IsNotEmpty()
  @IsEnum(PaymentMethod, {
    message: 'payment method does not match allowed methods',
  })
  payment_method: PaymentMethod;

  @ApiProperty({ example: 'TXN123456', description: 'Payment reference number' })
  @IsNotEmpty()
  @IsString()
  payment_reference: string;
}
