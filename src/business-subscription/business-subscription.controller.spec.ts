import { Test, TestingModule } from '@nestjs/testing';
import { BusinessSubscriptionController } from './business-subscription.controller';

describe('BusinessSubscriptionController', () => {
  let controller: BusinessSubscriptionController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BusinessSubscriptionController],
    }).compile();

    controller = module.get<BusinessSubscriptionController>(BusinessSubscriptionController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
