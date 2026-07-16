import { Controller, Post, UseGuards, Body } from '@nestjs/common';
import { CreateBusinessDto } from './dto/bussiness.dto';
import { BusinessService } from './bussiness.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { ActiveUser } from 'src/common/decorators/active-user.decorator';

@Controller('business')
@UseGuards(JwtAuthGuard)
export class BusinessController {
  constructor(private readonly businessService: BusinessService) {}
  @Post('create-business')
  async createBusiness(
    @Body()
    payload: CreateBusinessDto,
    @ActiveUser('sub') userId: string,
  ) {
    return this.businessService.createBusiness(payload, userId);
  }
}
