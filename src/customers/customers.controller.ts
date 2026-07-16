import { Controller, Post, Body, Param, UseGuards } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { RegisterCustomerDto } from './dto/customers.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { ActiveUser } from 'src/common/decorators/active-user.decorator';

@Controller('customers')
export class CustomersController {
  // 1. Constructor ONLY injects your service layer
  constructor(private readonly customersService: CustomersService) {}

  @Post('business/:businessId/register')
  @UseGuards(JwtAuthGuard)
  async registerCustomer(
    @ActiveUser() user: { sub: string },
    @Param('businessId') businessId: string,
    @Body() registerCustomerDto: RegisterCustomerDto,
  ) {
    const userId = Number(user.sub);

    return await this.customersService.registerCustomer(
      registerCustomerDto,
      businessId,
      userId,
    );
  }
}
