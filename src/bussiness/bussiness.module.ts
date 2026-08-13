import { Module } from '@nestjs/common';
import { BusinessController } from './bussiness.controller';
import { BusinessService } from './bussiness.service';
import { BusinessEntity } from './entities/bussiness.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from 'src/auth/entities/auth.entity';

@Module({
  imports: [TypeOrmModule.forFeature([BusinessEntity, UserEntity])],
  controllers: [BusinessController],
  providers: [BusinessService],
})
export class BusinessModule {}
