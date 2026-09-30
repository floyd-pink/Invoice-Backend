import {
  Body,
  Controller,
  Post,
  UseGuards,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { PaymentsService } from './payments.service';
import { ReceivePaymentDto } from './dto/receive-payment.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';

@ApiTags('Payments')
@ApiBearerAuth('JWT-auth')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentService: PaymentsService) {}

  @Post('invoice/:invoiceId/receive-payment')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Record a payment received for an invoice' })
  @ApiParam({ name: 'invoiceId', description: 'Invoice UUID' })
  @ApiResponse({ status: 201, description: 'Payment recorded successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async receivePayment(
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
    @Body() payload: ReceivePaymentDto,
  ) {
    return this.paymentService.receivePayment(payload, invoiceId);
  }
}
