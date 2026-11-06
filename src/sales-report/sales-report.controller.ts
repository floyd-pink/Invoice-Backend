import { Controller } from '@nestjs/common';
import { SalesReportDto } from './dto/sales-report.dto';
import { SalesReportInvoicesDto } from './dto/sales-report-invoices.dto';
import { SalesReportService } from './sales-report.service';
import { Get, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { BusinessId } from 'src/common/decorators/business-id.decorator';

@ApiTags('Sales Report')
@ApiBearerAuth('JWT-auth')
@Controller('sales-report')
export class SalesReportController {
  constructor(private readonly salesReportService: SalesReportService) {}

  @Get('invoices')
  @ApiOperation({
    description: 'Get a page of invoices created on one UTC date',
  })
  getDayInvoices(
    @Query() query: SalesReportInvoicesDto,
    @BusinessId() businessId: string,
  ) {
    return this.salesReportService.getDayInvoices(query, businessId);
  }

  @Get()
  @ApiOperation({
    description: 'Get period totals and daily invoice totals in UTC',
  })
  async getSalesReport(
    @Query() query: SalesReportDto,
    @BusinessId() businessId: string,
  ) {
    return await this.salesReportService.getSalesReport(query, businessId);
  }
}
