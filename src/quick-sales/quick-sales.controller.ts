import { Controller, Post, UseGuards, Body, Get, Query } from '@nestjs/common';

import { QuickSalesService } from './quick-sales.service';
import { JwtAuthGuard } from 'src/common/guards/guards.module';
import { BusinessId } from 'src/common/decorators/business-id.decorator';
import { CreateQuickSalesDto } from './dto/quickSales.dto';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  QuickSalesQueryDto,
  QuickSalesReportDto,
} from './dto/quick-sales-query.dto';

@ApiTags('Quick Sales')
@ApiBearerAuth('JWT-auth')
@Controller('quick-sales')
@UseGuards(JwtAuthGuard)
export class QuickSalesController {
  constructor(private readonly quickSalesService: QuickSalesService) {}

  @Post('create-quick-sale')
  @ApiOperation({
    summary: 'Create a quick sale (walk-in, no customer required)',
  })
  @ApiResponse({ status: 201, description: 'Quick sale created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Business not found' })
  async createQuickSale(
    @BusinessId() businessId: string,
    @Body() dto: CreateQuickSalesDto,
  ) {
    return this.quickSalesService.createQuickSale(dto, businessId);
  }
  @Get('my-quick-sales')
  @ApiOperation({ summary: 'Get quick sales for current user business' })
  @ApiResponse({ status: 200, description: 'List of quick sales with items' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Business not found' })
  async getMyQuickSales(
    @BusinessId() businessId: string,
    @Query() query: QuickSalesQueryDto,
  ) {
    return this.quickSalesService.getQuickSales(businessId, query.date);
  }

  @Get('my-quick-sales-report')
  @ApiOperation({ summary: 'Get quick sales report for current user business' })
  @ApiResponse({
    status: 200,
    description: 'Daily quick sales counts and total amounts',
  })
  @ApiResponse({ status: 400, description: 'Invalid date range' })
  @ApiResponse({ status: 404, description: 'Business not found' })
  async getMyQuickSalesReport(
    @BusinessId() businessId: string,
    @Query() query: QuickSalesReportDto,
  ) {
    return this.quickSalesService.getQuickSalesReport(businessId, query);
  }
}
