import { Test, TestingModule } from '@nestjs/testing';
import { QuickSalesService } from './quick-sales.service';

describe('QuickSalesService', () => {
  let service: QuickSalesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [QuickSalesService],
    }).compile();

    service = module.get<QuickSalesService>(QuickSalesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
