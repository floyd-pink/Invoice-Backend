import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsInt,
  Min,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from 'src/payments/entities/invoicePayments.entity';

export class QuickSaleItemDto {
  @ApiProperty({ example: 'Pen', description: 'Item name' })
  @IsNotEmpty()
  @IsString()
  itemName: string;

  @ApiProperty({ example: 10, description: 'Unit price' })
  @IsNotEmpty()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPrice: number;

  @ApiProperty({ example: 2, description: 'Quantity' })
  @IsNotEmpty()
  @IsInt()
  @Min(1)
  itemQuantity: number;
}

export class CreateQuickSalesDto {
  @ApiProperty({ type: [QuickSaleItemDto], description: 'Items sold' })
  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuickSaleItemDto)
  items: QuickSaleItemDto[];

  @ApiProperty({ enum: PaymentMethod, example: 'CASH' })
  @IsNotEmpty()
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @ApiPropertyOptional({ example: 'Walk-in customer' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: 'TXN123456' })
  @IsOptional()
  @IsString()
  paymentReference?: string;
}
