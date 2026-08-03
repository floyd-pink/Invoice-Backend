import { Repository, DataSource } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable } from '@nestjs/common';
import { ReceivePaymentDto } from './dto/receive-payment.dto';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  InvoiceEntity,
  InvoiceStatus,
} from 'src/invoice_items/entities/invoice.entity';
import { InvoicePaymentsEntity } from './entities/invoicePayments.entity';
import { InvoiceCalculationService } from 'src/invoice_items/services/invoice-calculation.service';
@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(InvoiceEntity)
    private readonly invoiceRepository: Repository<InvoiceEntity>,
    private readonly dataSource: DataSource,
    private readonly invoiceCalculationService: InvoiceCalculationService,
  ) {}

  async receivePayment(payload: ReceivePaymentDto, invoiceId: string) {
    const invoice = await this.invoiceRepository.findOne({
      where: {
        id: invoiceId,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new BadRequestException(
        'Cannot receive payment for a cancelled invoice',
      );
    }

    if (invoice.status === InvoiceStatus.PAID) {
      throw new BadRequestException('Invoice is already fully paid');
    }

    if (payload.payment_amount > invoice.dueAmount) {
      throw new BadRequestException(
        'Payment amount exceeds remaining due amount',
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const payment = queryRunner.manager.create(InvoicePaymentsEntity, {
        invoice,
        paymentId: `PAY-${Date.now()}`,
        amountPaid: payload.payment_amount,
        paymentMethod: payload.payment_method,
        paymentReference: payload.payment_reference,
        receivedAt: new Date(),
      });

      await queryRunner.manager.save(payment);
      //main logic to update the invoice status and amounts

      invoice.paidAmount += payload.payment_amount;

      this.invoiceCalculationService.updateInvoiceStatus(invoice);
      await queryRunner.manager.save(invoice);

      const updatedInvoice = await queryRunner.manager.findOne(InvoiceEntity, {
        where: { id: invoiceId },
      });
      await queryRunner.commitTransaction();

      return {
        message: 'Payment received successfully',
        payment,
        paidAmount: updatedInvoice?.paidAmount,
        dueAmount: updatedInvoice?.dueAmount,
        status: updatedInvoice?.status,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
