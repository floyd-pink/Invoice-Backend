import { BusinessCustomer } from 'src/business-customer/entities/business-customer.entity';
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { CreateInvoiceDto } from '../invoice_items/dto/invoice_items.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BusinessEntity } from 'src/bussiness/entities/bussiness.entity';
import { DataSource } from 'typeorm';
import { InvoiceEntity } from './entities/invoice.entity';
import { InvoiceItemsEntity } from './entities/invoiceItems.entity';

@Injectable()
export class InvoiceItemsService {
  constructor(
    @InjectRepository(BusinessEntity)
    private readonly BusinessRepository: Repository<BusinessEntity>,
    @InjectRepository(BusinessCustomer)
    private readonly BusinessCustomerRepository: Repository<BusinessCustomer>,
    private readonly dataSource: DataSource,
  ) {}
  async createInvoice(
    payload: CreateInvoiceDto,
    businessId: string,
    userId: number,
  ) {
    const business = await this.BusinessRepository.findOne({
      where: { business_id: businessId },
      relations: { owner: true },
    });

    if (!business) {
      throw new NotFoundException('Business not found');
    }

    if (business.owner.id !== userId) {
      throw new ForbiddenException(
        'you are not allowed to create invoice for this business',
      );
    }
    const businessCustomer = await this.BusinessCustomerRepository.findOne({
      where: { businessId: businessId, customerId: payload.customer_id },
      relations: { customer: true },
    });
    if (!businessCustomer) {
      throw new NotFoundException(
        'This customer does not belong to your business',
      );
    }

    const items = payload.items.map((item) => {
      const totalPrice = item.item_price * item.item_quantity;
      return {
        ...item,
        totalUnitPrice: totalPrice,
      };
    });
    const totalAmount = items.reduce(
      (sum, item) => sum + item.totalUnitPrice,
      0,
    );
    const paidAmount = payload.paid_amount ?? 0;
    const dueAmount = totalAmount - paidAmount;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      //first creating Invoice
      const invoice = queryRunner.manager.create(InvoiceEntity, {
        business,
        customer: businessCustomer.customer,
        totalAmount,
        paidAmount,
        dueAmount,
        notes: payload.notes,
      });
      await queryRunner.manager.save(invoice);
      //creating Invoice Items

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

      await queryRunner.commitTransaction();
      return { message: 'Invoice created Successfully', invoice };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
