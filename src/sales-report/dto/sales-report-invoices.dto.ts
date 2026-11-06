import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SalesReportInvoicesDto {
  @ApiProperty({
    example: '2026-11-05',
    description: 'UTC calendar date within the past 3 months through today',
  })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must use YYYY-MM-DD' })
  @IsDateString()
  date: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
