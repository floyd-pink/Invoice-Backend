import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { BusinessSubscriptionEntity } from './entities/business-subscription.entity';
import { Repository } from 'typeorm/browser/repository/Repository.js';
import { BusinessEntity } from 'src/bussiness/entities/bussiness.entity';
import { PlanEntity } from 'src/plans/entities/plan.entity';

@Injectable()
export class BusinessSubscriptionService {
  constructor(
    @InjectRepository(BusinessSubscriptionEntity)
    private readonly businessSubscriptionRepository: Repository<BusinessSubscriptionEntity>,
    @InjectRepository(BusinessEntity)
    private readonly businessRepository: Repository<BusinessEntity>,
    @InjectRepository(PlanEntity)
    private readonly planRepository: Repository<PlanEntity>,
  ) {}
}
