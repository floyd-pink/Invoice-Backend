import { Module } from '@nestjs/common';
import { PlansController } from './plans.controller';
import { PlansService } from './plans.service';
import { PlanEntity } from './entities/plan.entity';
import { PlanSeeder } from './seed/plan.seeder';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlanFeatureEntity } from './entities/plan-feature.entity';
@Module({
  imports: [TypeOrmModule.forFeature([PlanEntity, PlanFeatureEntity])],

  providers: [PlansService, PlanSeeder],

  controllers: [PlansController],
})
export class PlansModule {}
