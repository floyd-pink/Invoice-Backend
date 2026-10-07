import { Test, TestingModule } from '@nestjs/testing';
import { QuickSalesController } from './quick-sales.controller';

describe('QuickSalesController', () => {
  let controller: QuickSalesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [QuickSalesController],
    }).compile();

    controller = module.get<QuickSalesController>(QuickSalesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
