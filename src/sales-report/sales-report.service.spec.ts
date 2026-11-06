import { BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import {
  InvoiceEntity,
  InvoiceStatus,
} from 'src/invoice_items/entities/invoice.entity';
import { SalesReportService } from './sales-report.service';

describe('SalesReportService', () => {
  const builder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    setParameter: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getRawMany: jest.fn(),
    getManyAndCount: jest.fn(),
  };
  const repository = {
    createQueryBuilder: jest.fn(() => builder),
  };
  const service = new SalesReportService(
    repository as unknown as Repository<InvoiceEntity>,
  );

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-06T12:34:00.000Z'));
    jest.clearAllMocks();
    builder.getRawMany.mockResolvedValue([
      {
        date: '2026-11-05',
        totalInvoices: '1',
        totalSales: '100.00',
        totalPaid: '40.00',
        totalUnpaid: '60.00',
        totalOverdue: '0',
      },
    ]);
    builder.getManyAndCount.mockResolvedValue([[], 0]);
  });

  afterEach(() => jest.useRealTimers());

  it('scopes aggregates to the business, included statuses, and full UTC dates', async () => {
    const result = await service.getSalesReport(
      { from: '2026-11-04', to: '2026-11-05' },
      'business-1',
    );

    expect(builder.where).toHaveBeenCalledWith(
      'invoice.businessId = :businessId',
      { businessId: 'business-1' },
    );
    expect(builder.andWhere).toHaveBeenCalledWith(
      'invoice.createdAt >= :start AND invoice.createdAt < :end',
      {
        start: '2026-11-04 00:00:00.000',
        end: '2026-11-06 00:00:00.000',
      },
    );
    expect(builder.andWhere).toHaveBeenCalledWith(
      'invoice.status NOT IN (:...excludedStatuses)',
      { excludedStatuses: [InvoiceStatus.DRAFT, InvoiceStatus.CANCELLED] },
    );
    expect(result.summary).toEqual({
      totalInvoices: 1,
      totalSales: '100.00',
      totalPaid: '40.00',
      totalUnpaid: '60.00',
      totalOverdue: 0,
    });
    expect(result.days).toEqual([
      {
        date: '2026-11-04',
        totalInvoices: 0,
        totalSales: '0.00',
        totalPaid: '0.00',
        totalUnpaid: '0.00',
        totalOverdue: 0,
      },
      {
        date: '2026-11-05',
        totalInvoices: 1,
        totalSales: '100.00',
        totalPaid: '40.00',
        totalUnpaid: '60.00',
        totalOverdue: 0,
      },
    ]);
  });

  it('returns zeros when no invoices match', async () => {
    builder.getRawMany.mockResolvedValue([]);
    const result = await service.getSalesReport(
      { from: '2026-11-05', to: '2026-11-05' },
      'business-1',
    );
    expect(result.days).toHaveLength(1);
    expect(result.days[0].totalInvoices).toBe(0);
    expect(result.summary.totalSales).toBe('0.00');
  });

  it('adds daily money totals exactly from a single aggregate result', async () => {
    builder.getRawMany.mockResolvedValue([
      {
        date: '2026-11-04',
        totalInvoices: '1',
        totalSales: '0.10',
        totalPaid: '0.00',
        totalUnpaid: '0.10',
        totalOverdue: '0',
      },
      {
        date: '2026-11-05',
        totalInvoices: '1',
        totalSales: '0.20',
        totalPaid: '0.20',
        totalUnpaid: '0.00',
        totalOverdue: '0',
      },
    ]);
    const result = await service.getSalesReport(
      { from: '2026-11-04', to: '2026-11-05' },
      'business-1',
    );
    expect(result.summary.totalSales).toBe('0.30');
    expect(result.summary.totalPaid).toBe('0.20');
    expect(result.summary.totalUnpaid).toBe('0.10');
    expect(builder.getRawMany).toHaveBeenCalledTimes(1);
  });

  it('rejects dates older than the rolling three-month window', async () => {
    await expect(
      service.getSalesReport(
        { from: '2026-08-05', to: '2026-11-05' },
        'business-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('defaults to the last seven UTC dates through today and never adds future days', async () => {
    const result = await service.getSalesReport({}, 'business-1');
    expect(result.period).toEqual({
      from: '2026-10-31',
      to: '2026-11-06',
      timeZone: 'UTC',
    });
    expect(result.days).toHaveLength(7);
    expect(result.days[0].date).toBe('2026-10-31');
    expect(result.days.at(-1)?.date).toBe('2026-11-06');
    expect(builder.andWhere).toHaveBeenCalledWith(
      'invoice.createdAt >= :start AND invoice.createdAt < :end',
      { start: '2026-10-31 00:00:00.000', end: '2026-11-06 12:34:00.000' },
    );
  });

  it('accepts the earliest allowed date and rejects tomorrow', async () => {
    await service.getSalesReport(
      { from: '2026-08-06', to: '2026-11-06' },
      'business-1',
    );
    expect(builder.getRawMany).toHaveBeenCalledTimes(1);
    await expect(
      service.getSalesReport(
        { from: '2026-11-06', to: '2026-11-07' },
        'business-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns a bounded, ordered page for one UTC day', async () => {
    await service.getDayInvoices(
      { date: '2026-11-05', page: 2, limit: 10 },
      'business-1',
    );

    expect(builder.where).toHaveBeenCalledWith(
      'invoice.businessId = :businessId',
      { businessId: 'business-1' },
    );
    expect(builder.andWhere).toHaveBeenCalledWith(
      'invoice.createdAt >= :start AND invoice.createdAt < :end',
      { start: '2026-11-05 00:00:00.000', end: '2026-11-06 00:00:00.000' },
    );
    expect(builder.andWhere).toHaveBeenCalledWith(
      'invoice.status NOT IN (:...excludedStatuses)',
      { excludedStatuses: [InvoiceStatus.DRAFT, InvoiceStatus.CANCELLED] },
    );
    expect(builder.orderBy).toHaveBeenCalledWith('invoice.createdAt', 'DESC');
    expect(builder.addOrderBy).toHaveBeenCalledWith('invoice.id', 'DESC');
    expect(builder.skip).toHaveBeenCalledWith(10);
    expect(builder.take).toHaveBeenCalledWith(10);
  });

  it("caps today's detail at now and rejects future or old days", async () => {
    await service.getDayInvoices({ date: '2026-11-06' }, 'business-1');
    expect(builder.andWhere).toHaveBeenCalledWith(
      'invoice.createdAt >= :start AND invoice.createdAt < :end',
      { start: '2026-11-06 00:00:00.000', end: '2026-11-06 12:34:00.000' },
    );
    await expect(
      service.getDayInvoices({ date: '2026-11-07' }, 'business-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.getDayInvoices({ date: '2026-08-05' }, 'business-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
