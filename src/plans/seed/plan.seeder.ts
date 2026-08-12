import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { PlanEntity } from '../entities/plan.entity';
import { PlanFeatureEntity } from '../entities/plan-feature.entity';

import { DEFAULT_PLAN_CONFIGS } from './plan.config';

@Injectable()
export class PlanSeeder implements OnModuleInit {
  private readonly logger = new Logger(PlanSeeder.name);

  constructor(
    @InjectRepository(PlanEntity)
    private readonly planRepository: Repository<PlanEntity>,

    @InjectRepository(PlanFeatureEntity)
    private readonly planFeatureRepository: Repository<PlanFeatureEntity>,
  ) {}
  async onModuleInit() {
    await this.seed();
  }

  async seed() {
    for (const config of DEFAULT_PLAN_CONFIGS) {
      let plan = await this.planRepository.findOne({
        where: {
          type: config.type,
        },
      });

      if (!plan) {
        plan = this.planRepository.create({
          type: config.type,
          name: config.name,
          price: config.price,
        });

        plan = await this.planRepository.save(plan);

        this.logger.log(`Created plan: ${config.type}`);
      }

      this.logger.log(`PLAN: ${config.type} | ID: ${plan?.id}`);

      for (const featureConfig of config.features) {
        const existingFeature = await this.planFeatureRepository.findOne({
          where: {
            plan: {
              id: plan.id,
            },
            feature: featureConfig.feature,
          },
        });

        if (!existingFeature) {
          const feature = this.planFeatureRepository.create({
            plan,
            feature: featureConfig.feature,
            limit: featureConfig.limit,
            limitPeriod: featureConfig.period,
          });

          await this.planFeatureRepository.save(feature);

          this.logger.log(`Added ${featureConfig.feature} to ${config.type}`);
        }
      }
    }

    this.logger.log('Plan seeding completed');
  }
}
