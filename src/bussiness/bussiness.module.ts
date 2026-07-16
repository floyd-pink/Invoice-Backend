import { Module } from '@nestjs/common';
import { BusinessController } from './bussiness.controller';
import { BusinessService } from './bussiness.service';
import { BusinessEntity } from './entities/bussiness.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [TypeOrmModule.forFeature([BusinessEntity]), JwtModule],
  controllers: [BusinessController],
  providers: [BusinessService],
})
export class BusinessModule {}
