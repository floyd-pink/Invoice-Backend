// src/quick-sales/quick-sales.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuickSalesController } from './quick-sales.controller';
import { QuickSalesService } from './quick-sales.service';
import { QuickSalesEntity } from './entities/quickSales.entity';
import { QuickSalesItemEntity } from './entities/quickSalesItem.entity';
import { BusinessEntity } from 'src/bussiness/entities/bussiness.entity';
import { PlanEnforcementModule } from 'src/plans/plan-enforcement.module'; // <-- add

@Module({
  imports: [
    TypeOrmModule.forFeature([
      QuickSalesEntity,
      QuickSalesItemEntity,
      BusinessEntity,
    ]),
    PlanEnforcementModule, // <-- add
  ],
  controllers: [QuickSalesController],
  providers: [QuickSalesService],
  exports: [QuickSalesService],
})
export class QuickSalesModule {}
