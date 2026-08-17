import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlanEntity } from './entities/plan.entity';
import { PlanFeatureEntity } from './entities/plan-feature.entity';
import { PlanType } from './enum/plan-type.enum';
import { RedisService } from 'src/common/redis/redis.service';

@Injectable()
export class PlansService {
  constructor(
    @InjectRepository(PlanEntity)
    private readonly planRepository: Repository<PlanEntity>,
    @InjectRepository(PlanFeatureEntity)
    private readonly planFeatureRepository: Repository<PlanFeatureEntity>,
    private readonly redisService: RedisService,
  ) {}

  async findAll() {
    return this.planRepository.find({ relations: { features: true } });
  }

  async findOne(id: number) {
    return this.planRepository.findOne({
      where: { id },
      relations: { features: true },
    });
  }

  async update(id: number, updateData: Partial<PlanEntity>) {
    const plan = await this.planRepository.findOne({
      where: { id },
      relations: { features: true },
    });
    if (!plan) throw new NotFoundException('Plan not found');

    Object.assign(plan, updateData);
    const updated = await this.planRepository.save(plan);

    // ── Invalidate free plan cache if we just modified it ──
    if (updated.type === PlanType.FREE) {
      await this.redisService.invalidateFreePlan();
    }

    return updated;
  }
}
