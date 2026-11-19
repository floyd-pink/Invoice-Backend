import { IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsValidUtcDate } from 'src/common/decorators/is-valid-utc-date.validator';

export class QuickSalesQueryDto {
  @ApiPropertyOptional({
    example: '2026-11-07',
    description: 'Filter by UTC calendar date (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsValidUtcDate()
  date?: string;
}

export class QuickSalesReportDto {
  @ApiPropertyOptional({
    example: '2026-11-05',
    description:
      'Inclusive UTC date; omit both dates for the default seven-day report. Custom ranges can cover at most 3 calendar months and cannot include future dates.',
  })
  @IsOptional()
  @IsValidUtcDate()
  to?: string;

  @ApiPropertyOptional({
    example: '2026-11-01',
    description:
      'Inclusive UTC date; omit both dates for the default seven-day report. Custom ranges can cover at most 3 calendar months and cannot include future dates.',
  })
  @IsOptional()
  @IsValidUtcDate()
  from?: string;
}
