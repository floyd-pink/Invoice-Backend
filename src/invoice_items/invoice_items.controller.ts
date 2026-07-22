import { Body, Controller, Post, UseGuards, Param } from '@nestjs/common';
import { CreateInvoiceDto } from '../invoice_items/dto/invoice_items.dto';
import { InvoiceItemsService } from './invoice_items.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { ActiveUser } from 'src/common/decorators/active-user.decorator';
@Controller('invoice-items')
export class InvoiceItemsController {
  constructor(private readonly invoiceItemsService: InvoiceItemsService) {}
  @Post('business/:businessId/create-invoice')
  @UseGuards(JwtAuthGuard)
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
