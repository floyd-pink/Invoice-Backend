import { Body, Controller, Post, UseGuards, Param, Get } from '@nestjs/common';
import { CreateInvoiceDto } from '../invoice_items/dto/invoice_items.dto';
import { InvoiceItemsService } from './invoice_items.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { ActiveUser } from 'src/common/decorators/active-user.decorator';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';

@ApiTags('Invoices')
@ApiBearerAuth('JWT-auth')
@Controller('invoice-items')
export class InvoiceItemsController {
  constructor(private readonly invoiceItemsService: InvoiceItemsService) {}

  @Post('business/:businessId/create-invoice')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create a new invoice for a business' })
  @ApiParam({ name: 'businessId', description: 'Business UUID' })
  @ApiResponse({ status: 201, description: 'Invoice created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Business not found' })
  async createInvoice(
    @ActiveUser() user: { sub: string },
    @Body() invoice_payload: CreateInvoiceDto,
    @Param('businessId') businessId: string,
  ) {
    const userId = Number(user.sub);

    return this.invoiceItemsService.createInvoice(
      invoice_payload,
      businessId,
      userId,
    );
  }
}
