import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  InvoiceEntity,
  InvoiceStatus,
} from 'src/invoice_items/entities/invoice.entity';
import { SalesReportDto } from './dto/sales-report.dto';
import { SalesReportInvoicesDto } from './dto/sales-report-invoices.dto';

type AggregateRow = {
  totalInvoices: string;
  totalSales: string;
  totalPaid: string;
  totalUnpaid: string;
  totalOverdue: string;
};

type DailyAggregateRow = AggregateRow & { date: string };

@Injectable()
export class SalesReportService {
  constructor(
    @InjectRepository(InvoiceEntity)
    private readonly invoiceRepository: Repository<InvoiceEntity>,
  ) {}

  async getSalesReport(query: SalesReportDto, businessId: string) {
    const { from, to, start, lastDay, end } = this.reportRange(query);
    const baseQuery = this.invoiceRepository
      .createQueryBuilder('invoice')
      .where('invoice.businessId = :businessId', { businessId })
      .andWhere('invoice.createdAt >= :start AND invoice.createdAt < :end', {
        start: this.utcTimestamp(start),
        end: this.utcTimestamp(end),
      })
      .andWhere('invoice.status NOT IN (:...excludedStatuses)', {
        excludedStatuses: [InvoiceStatus.DRAFT, InvoiceStatus.CANCELLED],
      });

    const dayExpression = "TO_CHAR(invoice.createdAt, 'YYYY-MM-DD')";
    const dailyRows = await baseQuery
      .select(dayExpression, 'date')
      .addSelect('COUNT(invoice.id)', 'totalInvoices')
      .addSelect(
        'COALESCE(SUM(invoice.totalAmount), 0)::numeric(20,2)',
        'totalSales',
      )
      .addSelect(
        'COALESCE(SUM(invoice.paidAmount), 0)::numeric(20,2)',
        'totalPaid',
      )
      .addSelect(
        'COALESCE(SUM(invoice.totalAmount - invoice.paidAmount), 0)::numeric(20,2)',
        'totalUnpaid',
      )
      .addSelect(
        'COUNT(invoice.id) FILTER (WHERE invoice.status = :overdueStatus)',
        'totalOverdue',
      )
      .setParameter('overdueStatus', InvoiceStatus.OVERDUE)
      .groupBy(dayExpression)
      .orderBy(dayExpression, 'ASC')
      .getRawMany<DailyAggregateRow>();

    const dailyTotals = new Map(
      dailyRows.map(({ date, ...totals }) => [date, totals]),
    );
    const days: Array<{ date: string } & ReturnType<typeof this.toTotals>> = [];
    const summary = this.toTotals();
    for (
      const date = new Date(start);
      date <= lastDay;
      date.setUTCDate(date.getUTCDate() + 1)
    ) {
      const day = date.toISOString().slice(0, 10);
      const totals = this.toTotals(dailyTotals.get(day));
      days.push({ date: day, ...totals });
      summary.totalInvoices += totals.totalInvoices;
      summary.totalSales = this.addMoney(summary.totalSales, totals.totalSales);
      summary.totalPaid = this.addMoney(summary.totalPaid, totals.totalPaid);
      summary.totalUnpaid = this.addMoney(
        summary.totalUnpaid,
        totals.totalUnpaid,
      );
      summary.totalOverdue += totals.totalOverdue;
    }

    return {
      period: { from, to, timeZone: 'UTC' },
      summary,
      days,
    };
  }

  async getDayInvoices(query: SalesReportInvoicesDto, businessId: string) {
    const start = this.parseUtcDay(query.date);
    const now = new Date();
    const { earliest, today } = this.allowedWindow(now);
    this.assertAllowedDay(start, earliest, today);
    const end = start.getTime() === today.getTime() ? now : new Date(start);
    if (end !== now) end.setUTCDate(end.getUTCDate() + 1);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [invoices, total] = await this.invoiceRepository
      .createQueryBuilder('invoice')
      .select([
        'invoice.id',
        'invoice.invoiceNumber',
        'invoice.customerId',
        'invoice.status',
        'invoice.totalAmount',
        'invoice.paidAmount',
        'invoice.dueAmount',
      ])
      .where('invoice.businessId = :businessId', { businessId })
      .andWhere('invoice.createdAt >= :start AND invoice.createdAt < :end', {
        start: this.utcTimestamp(start),
        end: this.utcTimestamp(end),
      })
      .andWhere('invoice.status NOT IN (:...excludedStatuses)', {
        excludedStatuses: [InvoiceStatus.DRAFT, InvoiceStatus.CANCELLED],
      })
      .orderBy('invoice.createdAt', 'DESC')
      .addOrderBy('invoice.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      date: query.date,
      timeZone: 'UTC',
      invoices,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  private reportRange(query: SalesReportDto) {
    if ((query.from && !query.to) || (!query.from && query.to)) {
      throw new BadRequestException('Provide both from and to dates');
    }

    const now = new Date();
    const { earliest, today } = this.allowedWindow(now);
    const defaultStart = new Date(today);
    defaultStart.setUTCDate(defaultStart.getUTCDate() - 6);
    const from = query.from ?? defaultStart.toISOString().slice(0, 10);
    const to = query.to ?? today.toISOString().slice(0, 10);
    const start = this.parseUtcDay(from);
    const lastDay = this.parseUtcDay(to);

    if (start > lastDay) {
      throw new BadRequestException('Invalid date range');
    }
    this.assertAllowedDay(start, earliest, today);
    this.assertAllowedDay(lastDay, earliest, today);

    const end = lastDay.getTime() === today.getTime() ? now : new Date(lastDay);
    if (end !== now) end.setUTCDate(end.getUTCDate() + 1);
    return { from, to, start, lastDay, end };
  }

  private allowedWindow(now: Date) {
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth();
    const day = now.getUTCDate();
    const lastDayInTargetMonth = new Date(
      Date.UTC(year, month - 2, 0),
    ).getUTCDate();
    return {
      earliest: new Date(
        Date.UTC(year, month - 3, Math.min(day, lastDayInTargetMonth)),
      ),
      today: new Date(Date.UTC(year, month, day)),
    };
  }

  private assertAllowedDay(day: Date, earliest: Date, today: Date) {
    if (day < earliest || day > today) {
      throw new BadRequestException(
        'Date must be within the past 3 months through today (UTC)',
      );
    }
  }

  private parseUtcDay(value: string): Date {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new BadRequestException('Date must use YYYY-MM-DD');
    }
    const date = new Date(`${value}T00:00:00.000Z`);
    if (
      Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== value
    ) {
      throw new BadRequestException('Invalid date');
    }
    return date;
  }

  private utcTimestamp(value: Date): string {
    // The current PostgreSQL column is timestamp without time zone.
    return value.toISOString().replace('T', ' ').replace('Z', '');
  }

  private toTotals(row?: AggregateRow) {
    return {
      totalInvoices: Number(row?.totalInvoices ?? 0),
      totalSales: row?.totalSales ?? '0.00',
      totalPaid: row?.totalPaid ?? '0.00',
      totalUnpaid: row?.totalUnpaid ?? '0.00',
      totalOverdue: Number(row?.totalOverdue ?? 0),
    };
  }

  private addMoney(first: string, second: string): string {
    const cents =
      BigInt(first.replace('.', '')) + BigInt(second.replace('.', ''));
    const sign = cents < 0n ? '-' : '';
    const digits = (cents < 0n ? -cents : cents).toString().padStart(3, '0');
    return `${sign}${digits.slice(0, -2)}.${digits.slice(-2)}`;
  }
}
