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
    //is buiness exist at all?
    const business = await this.businessRepository.findOne({
      where: { business_id: businessId },
      relations: {
        owner: true,
      },
    });

    if (!business) {
      throw new NotFoundException('Business not found');
    }
    //is user and business owner same?
    if (business.owner.id !== userId) {
      throw new ForbiddenException(
        'Your dont have permission to add customer to this Business',
      );
    }
    //does customer already exists or not in customers table ?
    let customer = await this.customerRepository.findOne({
      where: { customer_phone: payload.customer_phone },
    });
    //when customer does not exist
    if (!customer) {
      customer = this.customerRepository.create(payload);
      customer = await this.customerRepository.save(customer);
    }
    //is customer is already associated with this business or not?
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
        customer_name: payload.customer_name, // Privacy protection rule
        customer_phone: payload.customer_phone,
      },
      customer_registered_businessId: business.business_id,
    };
  }
}
