import { Injectable } from '@nestjs/common';
import { UnauthorizedException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { BusinessCustomer } from 'src/business-customer/entities/business-customer.entity';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class BusinessCustomerService {
  constructor(
    @InjectRepository(BusinessCustomer)
    private readonly businessCustomerRepository: Repository<BusinessCustomer>,
  ) {}
  async getBusinessAssociatedCustomers(businessId: string, ownerId: number) {
    const businessAssociatedCustomers = await this.businessCustomerRepository
      //geting  all customers through TypeOrm query
      .createQueryBuilder('businessCustomer')
      .innerJoinAndSelect('businessCustomer.business', 'business')
      .innerJoinAndSelect('business.owner', 'owner')
      .innerJoinAndSelect('businessCustomer.customer', 'customer')
      .where('business.business_id = :businessId', { businessId })
      .getMany();

    if (businessAssociatedCustomers.length === 0) {
      return [];
    }
    if (businessAssociatedCustomers[0].business.owner.id !== ownerId) {
      throw new UnauthorizedException(
        'You dont have permission to access this business',
      );
    }

    return businessAssociatedCustomers.map((businessCustomer) => {
      return {
        customer_id: businessCustomer.customer.customer_id,
        customer_name: businessCustomer.customer.customer_name,
        customer_email: businessCustomer.customer.customer_email,
        customer_phone: businessCustomer.customer.customer_phone,
        associatedAt: businessCustomer.associatedAt,
      };
    });
  }
}
