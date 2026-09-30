import { Controller, Post, Body } from '@nestjs/common';
import { CreateBusinessDto } from './dto/bussiness.dto';
import { BusinessService } from './bussiness.service';
import { ActiveUser } from 'src/common/decorators/active-user.decorator';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';

@ApiTags('Business')
@ApiBearerAuth('JWT-auth')
@Controller('business')
export class BusinessController {
  constructor(private readonly businessService: BusinessService) {}

  @Post('create-business')
  @ApiOperation({ summary: 'Create a new business' })
  @ApiResponse({ status: 201, description: 'Business created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 409, description: 'Business already exists' })
  async createBusiness(
    @Body() payload: CreateBusinessDto,
    @ActiveUser('sub') userId: string,
  ) {
    return this.businessService.createBusiness(payload, userId);
  }
}
