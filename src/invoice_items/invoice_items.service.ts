import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { BusinessEntity } from 'src/bussiness/entities/bussiness.entity';
import { BusinessCustomer } from 'src/business-customer/entities/business-customer.entity';
import { CreateInvoiceDto } from './dto/invoice_items.dto';
import { InvoiceEntity } from './entities/invoice.entity';
import { InvoiceItemsEntity } from './entities/invoiceItems.entity';
import { InvoicePaymentsEntity } from 'src/payments/entities/invoicePayments.entity';
import { InvoiceCalculationService } from './services/invoice-calculation.service';
import { PaymentMethod } from 'src/payments/entities/invoicePayments.entity';
import { PlanEnforcementService } from 'src/plans/plan-enforcement.service';
import { PlanFeature } from 'src/plans/enum/plan-feature.enum';
@Injectable()
export class InvoiceItemsService {
  constructor(
    @InjectRepository(BusinessEntity)
    private readonly businessRepository: Repository<BusinessEntity>,

    @InjectRepository(BusinessCustomer)
    private readonly businessCustomerRepository: Repository<BusinessCustomer>,

    private readonly dataSource: DataSource,

    private readonly invoiceCalculationService: InvoiceCalculationService,

    private readonly planEnforcementService: PlanEnforcementService,
  ) {}

  async createInvoice(
    payload: CreateInvoiceDto,
    businessId: string,
    userId: number,
  ) {
    const business = await this.businessRepository.findOne({
      where: {
        business_id: businessId,
      },
      relations: {
        owner: true,
      },
    });

    if (!business) {
      throw new NotFoundException('Business not found');
    }

    if (business.owner.id !== userId) {
      throw new ForbiddenException(
        'You are not allowed to create invoice for this business',
      );
    }

    await this.planEnforcementService.checkPlanLimit(
      businessId,
      PlanFeature.Create_Invoice,
    );

    const businessCustomer = await this.businessCustomerRepository.findOne({
      where: {
        businessId,
        customerId: payload.customer_id,
      },
      relations: {
        customer: true,
      },
    });
    if (!businessCustomer) {
      throw new NotFoundException(
        'This customer does not belong to your business',
      );
    }
    const items = payload.items.map((item) => ({
      ...item,
      totalUnitPrice: item.item_price * item.item_quantity,
    }));
    const totalAmount = items.reduce(
      (sum, item) => sum + item.totalUnitPrice,
      0,
    );
    const paidAmount = payload.paid_amount ?? 0;

    if (paidAmount > totalAmount) {
      throw new BadRequestException('Paid amount cannot exceed invoice total.');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const invoice = queryRunner.manager.create(InvoiceEntity, {
        business,
        customer: businessCustomer.customer,
        totalAmount,
        paidAmount,
        notes: payload.notes,
      });

      this.invoiceCalculationService.updateInvoiceStatus(invoice);

      await queryRunner.manager.save(invoice);

      const invoiceItems = items.map((item) =>
        queryRunner.manager.create(InvoiceItemsEntity, {
          invoice,
          itemName: item.item_name,
          itemQuantity: item.item_quantity,
          unitPrice: item.item_price,
          totalUnitPrice: item.totalUnitPrice,
        }),
      );

      await queryRunner.manager.save(invoiceItems);

      if (paidAmount > 0) {
        const payment = queryRunner.manager.create(InvoicePaymentsEntity, {
          invoice,
          paymentId: `PAY-${Date.now()}`,
          amountPaid: paidAmount,
          paymentMethod:
            PaymentMethod[payload.payment_method as keyof typeof PaymentMethod], // Converts string from the payload to enum type of PaymentMethod
          paymentReference: payload.payment_reference,
          receivedAt: new Date(),
        });

        await queryRunner.manager.save(payment);
      }

      await queryRunner.commitTransaction();

      return {
        message: 'Invoice created successfully',
        invoice,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
