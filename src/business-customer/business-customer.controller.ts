import { Controller, UseGuards, Get, Param } from '@nestjs/common';
import { BusinessCustomerService } from './business-customer.service';
import { ActiveUser } from 'src/common/decorators/active-user.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';

@Controller('business-customer')
export class BusinessCustomerController {
  constructor(
    private readonly businessCustomerService: BusinessCustomerService,
  ) {}

  @Get(':businessId/customers')
  @UseGuards(JwtAuthGuard)
  async getBusinessAssociatedCustomer(
    @ActiveUser() user: { sub: string },
    @Param('businessId') businessId: string,
  ) {
    return this.businessCustomerService.getBusinessAssociatedCustomers(
      businessId,
      Number(user.sub),
    );
  }
}
