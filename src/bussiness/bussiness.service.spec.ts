import { Test, TestingModule } from '@nestjs/testing';
import { BussinessService } from './bussiness.service';

describe('BussinessService', () => {
  let service: BussinessService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BussinessService],
    }).compile();

    service = module.get<BussinessService>(BussinessService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
