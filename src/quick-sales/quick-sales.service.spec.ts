import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { QuickSalesService } from './quick-sales.service';
import { QuickSalesQueryDto } from './dto/quick-sales-query.dto';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('QuickSalesQueryDto', () => {
  it.each(['not-a-date', '2026-02-30', '2026-1-7'])(
    'rejects invalid date %s',
    (date) => {
      const query = plainToInstance(QuickSalesQueryDto, { date });
      expect(validateSync(query)).not.toHaveLength(0);
    },
  );

  it('accepts an optional valid UTC date', () => {
    expect(validateSync(plainToInstance(QuickSalesQueryDto, {}))).toHaveLength(
      0,
    );
    expect(
      validateSync(plainToInstance(QuickSalesQueryDto, { date: '2026-11-07' })),
    ).toHaveLength(0);
  });
});

describe('QuickSalesService.getQuickSales', () => {
  it('scopes the query to the business and uses a half-open UTC day', async () => {
    const query = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    const businessRepository = {
      findOne: jest.fn().mockResolvedValue({ business_id: 'business-1' }),
    };
    const quickSalesRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(query),
    };
    const service = new QuickSalesService(
      businessRepository as never,
      quickSalesRepository as never,
      {} as never,
      {} as never,
    );

    await service.getQuickSales('business-1', '2026-11-07');

    expect(query.where).toHaveBeenCalledWith('qs.businessId = :businessId', {
      businessId: 'business-1',
    });
    expect(query.andWhere).toHaveBeenCalledWith(
      'qs.createdAt >= :start AND qs.createdAt < :end',
      {
        start: '2026-11-07 00:00:00.000',
        end: '2026-11-08 00:00:00.000',
      },
    );
  });
});

describe('QuickSalesService.getQuickSalesReport', () => {
  const query = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn(),
  };
  const businessRepository = {
    findOne: jest.fn(),
  };
  const quickSalesRepository = {
    createQueryBuilder: jest.fn(() => query),
  };
  const service = new QuickSalesService(
    businessRepository as never,
    quickSalesRepository as never,
    {} as never,
    {} as never,
  );

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-19T12:34:00.000Z'));
    jest.clearAllMocks();
    businessRepository.findOne.mockResolvedValue({ business_id: 'business-1' });
    query.getRawMany.mockResolvedValue([]);
  });

  afterEach(() => jest.useRealTimers());

  it('defaults to seven UTC dates and includes the final day', async () => {
    await service.getQuickSalesReport('business-1', {});

    expect(query.where).toHaveBeenCalledWith('qs.businessId = :businessId', {
      businessId: 'business-1',
    });
    expect(query.andWhere).toHaveBeenCalledWith(
      'qs.createdAt >= :start AND qs.createdAt < :end',
      {
        start: '2026-11-13 00:00:00.000',
        end: '2026-11-19 12:34:00.000',
      },
    );
  });

  it('includes the full final day of a custom range', async () => {
    await service.getQuickSalesReport('business-1', {
      from: '2026-11-01',
      to: '2026-11-07',
    });

    expect(query.andWhere).toHaveBeenCalledWith(
      'qs.createdAt >= :start AND qs.createdAt < :end',
      {
        start: '2026-11-01 00:00:00.000',
        end: '2026-11-08 00:00:00.000',
      },
    );
  });

  it.each([
    {
      from: '2020-01-01',
      to: '2020-03-31',
      end: '2020-04-01 00:00:00.000',
    },
    {
      from: '2020-01-31',
      to: '2020-04-29',
      end: '2020-04-30 00:00:00.000',
    },
  ])(
    'accepts a historical range within three calendar months: %p',
    async ({ from, to, end }) => {
      await service.getQuickSalesReport('business-1', { from, to });

      expect(query.andWhere).toHaveBeenCalledWith(
        'qs.createdAt >= :start AND qs.createdAt < :end',
        { start: `${from} 00:00:00.000`, end },
      );
    },
  );

  it.each([
    { from: '2026-11-08', to: '2026-11-07' },
    { from: '2020-01-01', to: '2020-04-01' },
    { from: '2020-01-31', to: '2020-04-30' },
    { from: '2026-11-19', to: '2026-11-20' },
    { from: '2026-02-30', to: '2026-11-19' },
    { from: '2026-11-18' },
    { to: '2026-11-19' },
  ])('rejects an invalid report range %p', async (range) => {
    await expect(
      service.getQuickSalesReport('business-1', range),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(quickSalesRepository.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('returns 404 when the business does not exist', async () => {
    businessRepository.findOne.mockResolvedValue(null);

    await expect(
      service.getQuickSalesReport('missing-business', {}),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(quickSalesRepository.createQueryBuilder).not.toHaveBeenCalled();
  });
});
