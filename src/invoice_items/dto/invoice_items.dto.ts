import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsInt,
  Min,
  IsOptional,
  IsArray,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateInvoiceItemDto {
  @ApiProperty({ example: 'Web Development Services', description: 'Item name' })
  @IsNotEmpty()
  @IsString()
  item_name: string;

  @ApiProperty({ example: 150.00, description: 'Unit price' })
  @IsNotEmpty()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  item_price: number;

  @ApiProperty({ example: 2, description: 'Quantity' })
  @IsNotEmpty()
  @IsInt()
  @Min(1)
  item_quantity: number;
}

export class CreateInvoiceDto {
  @ApiProperty({ example: 'uuid-of-customer', description: 'Customer UUID' })
  @IsNotEmpty()
  @IsUUID()
  customer_id: string;

  @ApiPropertyOptional({ example: 50.00, description: 'Amount paid upfront' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  paid_amount: number;

  @ApiProperty({ example: 'CASH', description: 'Payment method' })
  @IsNotEmpty()
  @IsString()
  payment_method: string;

  @ApiPropertyOptional({ example: 'TXN123456', description: 'Payment reference' })
  @IsOptional()
  @IsString()
  payment_reference: string;

  @ApiPropertyOptional({ example: 'Payment due in 30 days', description: 'Notes' })
  @IsOptional()
  @IsString()
  notes: string;

  @ApiProperty({ type: [CreateInvoiceItemDto], description: 'Invoice items' })
  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceItemDto)
  items: CreateInvoiceItemDto[];
}
