import { IsDateString, IsOptional, Matches } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
export class SalesReportDto {
  @ApiPropertyOptional({
    example: '2026-11-05',
    description:
      'Inclusive UTC date; defaults to today. Must be within the past 3 months.',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'to must use YYYY-MM-DD' })
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({
    example: '2026-11-01',
    description:
      'Inclusive UTC date; defaults to six days before today (seven calendar days including today). Must be within the past 3 months.',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'from must use YYYY-MM-DD' })
  @IsDateString()
  from?: string;
}
