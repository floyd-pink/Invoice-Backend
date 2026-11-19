import {
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { JwtAuthGuard } from 'src/common/guards/guards.module';
import { QuickSalesController } from './quick-sales.controller';
import { QuickSalesService } from './quick-sales.service';
import { QuickSalesReportDto } from './dto/quick-sales-query.dto';

describe('QuickSalesController', () => {
  let app: INestApplication<App>;
  const quickSalesService = {
    getQuickSalesReport: jest.fn().mockResolvedValue({ dailyQuickSales: [] }),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [QuickSalesController],
      providers: [{ provide: QuickSalesService, useValue: quickSalesService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          context
            .switchToHttp()
            .getRequest<{ businessId: string }>().businessId = 'business-1';
          return true;
        },
      })
      .compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    await app.init();
  });

  afterEach(() => jest.clearAllMocks());
  afterAll(async () => app.close());

  it('keeps the report DTO available to Nest at runtime', () => {
    const parameterTypes = Reflect.getMetadata(
      'design:paramtypes',
      QuickSalesController.prototype,
      'getMyQuickSalesReport',
    ) as unknown[];
    expect(parameterTypes[1]).toBe(QuickSalesReportDto);
  });

  it('accepts an empty report query and passes the business ID', async () => {
    await request(app.getHttpServer())
      .get('/quick-sales/my-quick-sales-report')
      .expect(200);

    expect(quickSalesService.getQuickSalesReport).toHaveBeenCalledWith(
      'business-1',
      {},
    );
  });

  it('rejects an invalid report date before calling the service', async () => {
    await request(app.getHttpServer())
      .get('/quick-sales/my-quick-sales-report?from=2026-02-30&to=2026-11-19')
      .expect(400);

    expect(quickSalesService.getQuickSalesReport).not.toHaveBeenCalled();
  });
});
