import { Test, TestingModule } from '@nestjs/testing';
import { BusinessSubscriptionService } from './business-subscription.service';

describe('BusinessSubscriptionService', () => {
  let service: BusinessSubscriptionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BusinessSubscriptionService],
    }).compile();

    service = module.get<BusinessSubscriptionService>(BusinessSubscriptionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
