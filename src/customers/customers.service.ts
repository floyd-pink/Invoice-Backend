import {
  Injectable,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Customer } from './entities/customer.entity';
import type { Repository } from 'typeorm';
import { BusinessEntity } from 'src/bussiness/entities/bussiness.entity';
import { RegisterCustomerDto } from './dto/customers.dto';
import { BusinessCustomer } from 'src/business-customer/entities/business-customer.entity';
@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    @InjectRepository(BusinessEntity)
    private readonly businessRepository: Repository<BusinessEntity>,
    @InjectRepository(BusinessCustomer)
    private readonly businessCustomerRepository: Repository<BusinessCustomer>,
  ) {}

  async registerCustomer(
    payload: RegisterCustomerDto,
    businessId: string,
    userId: number,
  ) {
    // is business exist at all?
    const business = await this.businessRepository.findOne({
      where: { business_id: businessId },
      relations: { owner: true },
    });

    if (!business) {
      throw new NotFoundException('Business not found');
    }

    // is user the business owner?
    if (business.owner.id !== userId) {
      throw new ForbiddenException(
        'You dont have permission to add customer to this Business',
      );
    }
    const phoneMatch = await this.customerRepository.findOne({
      where: { customer_phone: payload.customer_phone },
    });
    const emailMatch = await this.customerRepository.findOne({
      where: { customer_email: payload.customer_email },
    });
    if (
      phoneMatch &&
      emailMatch &&
      phoneMatch.customer_id !== emailMatch.customer_id
    ) {
      throw new ConflictException(
        'Phone and email belong to different existing customers — please verify the details',
      );
    }

    let customer = phoneMatch ?? emailMatch ?? null;

    if (!customer) {
      customer = this.customerRepository.create(payload);
      try {
        customer = await this.customerRepository.save(customer);
      } catch (err: any) {
        if (err.code === '23505') {
          throw new ConflictException(
            'A customer with this phone or email already exists',
          );
        }
        throw err;
      }
    }

    // is customer already associated with this business?
    const isAlreadyAssociated = await this.businessCustomerRepository.findOne({
      where: {
        business: { business_id: businessId },
        customer: { customer_id: customer.customer_id },
      },
    });
    if (isAlreadyAssociated) {
      throw new ConflictException(
        'Customer is already registered with your business',
      );
    }

    const link = this.businessCustomerRepository.create({
      business,
      customer,
    });
    await this.businessCustomerRepository.save(link);

    return {
      message: 'Customer registered and linked successfully.',
      customer: {
        customer_id: customer.customer_id,
        customer_name: customer.customer_name,
        customer_phone: customer.customer_phone,
      },
      customer_registered_businessId: business.business_id,
    };
  }
}
