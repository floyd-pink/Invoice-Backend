import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { BusinessEntity } from 'src/bussiness/entities/bussiness.entity';
import { QuickSalesEntity } from './entities/quickSales.entity';
import { QuickSalesItemEntity } from './entities/quickSalesItem.entity';
import { CreateQuickSalesDto } from './dto/quickSales.dto';
import { QuickSaleStatus } from './entities/quickSales.entity';
import { PlanEnforcementService } from 'src/plans/plan-enforcement.service';
import { PlanFeature } from 'src/plans/enum/plan-feature.enum';
import type { QuickSalesReportDto } from './dto/quick-sales-query.dto';
import { isValidUtcCalendarDate } from 'src/common/decorators/is-valid-utc-date.validator';

type QuickSaleReport = {
  date: string;
  totalSales: string;
  totalAmount: string;
};
const utcTimestamp = (value: Date) =>
  value.toISOString().replace('T', ' ').replace('Z', '');

@Injectable()
export class QuickSalesService {
  constructor(
    @InjectRepository(BusinessEntity)
    private readonly businessRepository: Repository<BusinessEntity>,

    @InjectRepository(QuickSalesEntity)
    private readonly quickSalesRepository: Repository<QuickSalesEntity>,

    private readonly dataSource: DataSource,

    private readonly planEnforcementService: PlanEnforcementService,
  ) {}

  async createQuickSale(dto: CreateQuickSalesDto, businessId: string) {
    await this.assertBusinessExists(businessId);
    await this.planEnforcementService.checkPlanLimit(
      businessId,
      PlanFeature.Create_Quick_Sale,
    );

    const items = dto.items.map((item) => ({
      ...item,
      totalPrice: item.unitPrice * item.itemQuantity,
    }));
    const totalAmount = items.reduce((sum, item) => sum + item.totalPrice, 0);

    if (totalAmount <= 0) {
      throw new BadRequestException('Total amount must be greater than 0');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const quickSale = queryRunner.manager.create(QuickSalesEntity, {
        business: { business_id: businessId } as BusinessEntity,
        totalAmount,
        paymentMethod: dto.paymentMethod,
        paymentReference: dto.paymentReference,
        notes: dto.notes,
        status: QuickSaleStatus.COMPLETED,
      });

      await queryRunner.manager.save(quickSale);

      const quickSaleItems = items.map((item) =>
        queryRunner.manager.create(QuickSalesItemEntity, {
          quickSale,
          itemName: item.itemName,
          itemQuantity: item.itemQuantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
        }),
      );
      await queryRunner.manager.save(quickSaleItems);
      await queryRunner.commitTransaction();

      return {
        message: 'Quick sale created successfully',
        businessId: businessId,
        quickSaleId: quickSale.id,
        quickSaleTotalAmount: quickSale.totalAmount,
        quickSaleNumber: quickSale.quickSaleNumber,
        quickSaleItems: items.map((item) => ({
          itemName: item.itemName,
          itemQuantity: item.itemQuantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
        })),
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getQuickSales(businessId: string, date?: string) {
    await this.assertBusinessExists(businessId);
    const query = this.quickSalesRepository
      .createQueryBuilder('qs')
      .leftJoinAndSelect('qs.items', 'items')
      .where('qs.businessId = :businessId', {
        businessId: businessId,
      });

    if (date) {
      const start = new Date(`${date}T00:00:00.000Z`);
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 1);

      query.andWhere('qs.createdAt >= :start AND qs.createdAt < :end', {
        start: utcTimestamp(start),
        end: utcTimestamp(end),
      });
    }
    return query.orderBy('qs.createdAt', 'DESC').getMany();
  }

  async getQuickSalesReport(businessId: string, payload: QuickSalesReportDto) {
    if ((payload.from && !payload.to) || (!payload.from && payload.to)) {
      throw new BadRequestException('Provide both from and to dates');
    }

    const now = new Date();
    const today = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const sixDaysAgo = new Date(today);
    sixDaysAgo.setUTCDate(sixDaysAgo.getUTCDate() - 6);

    const to = payload.to ?? today.toISOString().slice(0, 10);
    const from = payload.from ?? sixDaysAgo.toISOString().slice(0, 10);

    if (!isValidUtcCalendarDate(from) || !isValidUtcCalendarDate(to)) {
      throw new BadRequestException('Dates must use YYYY-MM-DD');
    }
    const fromDate = new Date(`${from}T00:00:00.000Z`);
    const toDate = new Date(`${to}T00:00:00.000Z`);
    if (fromDate > toDate) {
      throw new BadRequestException(
        'From date must be before or equal to to date',
      );
    }

    if (toDate > today) {
      throw new BadRequestException('Future report dates are not allowed');
    }

    const requestedEnd = new Date(toDate);
    requestedEnd.setUTCDate(requestedEnd.getUTCDate() + 1);
    if (requestedEnd > this.threeCalendarMonthsAfter(fromDate)) {
      throw new BadRequestException('Report range cannot exceed 3 months');
    }

    await this.assertBusinessExists(businessId);
    const endDate = toDate.getTime() === today.getTime() ? now : requestedEnd;
    const baseQuery = this.quickSalesRepository
      .createQueryBuilder('qs')
      .where('qs.businessId = :businessId', { businessId })
      .andWhere('qs.status = :status', { status: QuickSaleStatus.COMPLETED })
      .andWhere('qs.createdAt >= :start AND qs.createdAt < :end', {
        start: utcTimestamp(fromDate),
        end: utcTimestamp(endDate),
      });
    const dailyQuickSales = await baseQuery
      .select("TO_CHAR(qs.createdAt, 'YYYY-MM-DD')", 'date')
      .addSelect('COUNT(qs.id)', 'totalSales')
      .addSelect('COALESCE(SUM(qs.totalAmount), 0)', 'totalAmount')
      .groupBy("TO_CHAR(qs.createdAt, 'YYYY-MM-DD')")
      .orderBy('date', 'ASC')
      .getRawMany<QuickSaleReport>();

    return {
      dailyQuickSales,
    };
  }

  private async assertBusinessExists(businessId: string): Promise<void> {
    const business = await this.businessRepository.findOne({
      where: { business_id: businessId },
      select: { business_id: true },
    });
    if (!business) {
      throw new NotFoundException('Business not found');
    }
  }

  private threeCalendarMonthsAfter(start: Date): Date {
    const limit = new Date(start);
    limit.setUTCDate(1);
    limit.setUTCMonth(limit.getUTCMonth() + 3);
    const lastDay = new Date(limit);
    lastDay.setUTCMonth(lastDay.getUTCMonth() + 1);
    lastDay.setUTCDate(0);
    limit.setUTCDate(Math.min(start.getUTCDate(), lastDay.getUTCDate()));
    return limit;
  }
}
