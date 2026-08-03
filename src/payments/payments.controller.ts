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

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentService: PaymentsService) {}
  @Post('invoice/:invoiceId/receive-payment')
  @UseGuards(JwtAuthGuard)
  async receivePayment(
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
    @Body() payload: ReceivePaymentDto,
  ) {
    return this.paymentService.receivePayment(payload, invoiceId);
  }
}
