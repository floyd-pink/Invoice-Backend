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

export class CreateInvoiceItemDto {
  @IsNotEmpty()
  @IsString()
  item_name: string;

  @IsNotEmpty()
  @IsNumber({ maxDecimalPlaces: 2 }) // Handles decimal type safely in TypeScript
  @Min(0)
  item_price: number;

  @IsNotEmpty()
  @IsInt() // Handles int type safely in TypeScript
  @Min(1)
  item_quantity: number;
}

export class CreateInvoiceDto {
  @IsNotEmpty()
  @IsUUID()
  customer_id: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  paid_amount: number;

  @IsNotEmpty()
  @IsString()
  payment_method: string;

  @IsOptional()
  @IsString()
  payment_reference: string;
  @IsOptional()
  @IsString()
  notes: string;

  // This links the items array to the invoice structure
  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceItemDto) //this dto rule to apply
  items: CreateInvoiceItemDto[];
}
