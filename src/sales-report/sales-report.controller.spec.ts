import { Test, TestingModule } from '@nestjs/testing';
import { SalesReportController } from './sales-report.controller';
import { SalesReportService } from './sales-report.service';

describe('SalesReportController', () => {
  let controller: SalesReportController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SalesReportController],
      providers: [{ provide: SalesReportService, useValue: {} }],
    }).compile();

    controller = module.get<SalesReportController>(SalesReportController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
