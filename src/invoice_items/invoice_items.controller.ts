import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CreateInvoiceDto } from '../invoice_items/dto/invoice_items.dto';
import { InvoiceItemsService } from './invoice_items.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { ActiveUser } from 'src/common/decorators/active-user.decorator';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { BusinessId } from 'src/common/decorators/business-id.decorator';

@ApiTags('Invoices')
@ApiBearerAuth('JWT-auth')
@Controller('invoice-items')
export class InvoiceItemsController {
  constructor(private readonly invoiceItemsService: InvoiceItemsService) {}

  @Post('create-invoice')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create a new invoice for a business' })
  @ApiResponse({ status: 201, description: 'Invoice created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Business not found' })
  async createInvoice(
    @ActiveUser() user: { sub: string },
    @Body() invoice_payload: CreateInvoiceDto,
    @BusinessId() businessId: string,
  ) {
    const userId = Number(user.sub);

    return this.invoiceItemsService.createInvoice(
      invoice_payload,
      businessId,
      userId,
    );
  }
}
