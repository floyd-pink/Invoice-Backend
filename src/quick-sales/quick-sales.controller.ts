import { Controller, Post, UseGuards, Body, Get, Query } from '@nestjs/common';

import { QuickSalesService } from './quick-sales.service';
import { JwtAuthGuard } from 'src/common/guards/guards.module';
import { ActiveUser } from 'src/common/decorators/active-user.decorator';
import { CreateQuickSalesDto } from './dto/quickSales.dto';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiQuery,
} from '@nestjs/swagger';

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
    @ActiveUser() user: { sub: string },
    @Body() dto: CreateQuickSalesDto,
  ) {
    const userId = Number(user.sub);
    return this.quickSalesService.createQuickSale(dto, userId);
  }
  @Get('my-quick-sales')
  @ApiOperation({ summary: 'Get quick sales for current user business' })
  @ApiQuery({
    name: 'date',
    required: false,
    description: 'Filter by date (YYYY-MM-DD)',
    example: '2026-10-06',
  })
  @ApiResponse({ status: 200, description: 'List of quick sales with items' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Business not found' })
  async getMyQuickSales(
    @ActiveUser() user: { sub: string },
    @Query('date') date?: string,
  ) {
    const userId = Number(user.sub);
    return this.quickSalesService.getQuickSales(
      userId,
      date ? new Date(date) : undefined,
    );
  }
}
