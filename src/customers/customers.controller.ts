import { Controller, Post, Body, Param, UseGuards } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { RegisterCustomerDto } from './dto/customers.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { ActiveUser } from 'src/common/decorators/active-user.decorator';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';

@ApiTags('Customers')
@ApiBearerAuth('JWT-auth')
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post('business/:businessId/register')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Register a new customer for a business' })
  @ApiParam({ name: 'businessId', description: 'Business UUID' })
  @ApiResponse({ status: 201, description: 'Customer registered successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Business not found' })
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
