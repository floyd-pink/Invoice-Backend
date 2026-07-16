import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsInt,
  Min,
  IsOptional,
  IsArray,
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
  @IsInt()
  business_id: number;

  @IsNotEmpty()
  @IsInt()
  customer_id: number;

  @IsNotEmpty()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  total_amount: number;

  @IsOptional() // Optional if they haven't made a down payment yet
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  paid_amount: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  due_amount: number;

  // This links the items array to the invoice structure
  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceItemDto) //this dto rule to apply
  items: CreateInvoiceItemDto[];
}
