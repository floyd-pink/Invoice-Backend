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

  async createQuickSale(dto: CreateQuickSalesDto, userId: number) {
    const business = await this.businessRepository.findOne({
      where: { owner: { id: userId } },
      select: {
        business_id: true,
      },
    });

    if (!business) {
      throw new NotFoundException('Business not found');
    }

    await this.planEnforcementService.checkPlanLimit(
      business.business_id,
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
        business: { business_id: business.business_id } as BusinessEntity,
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
        businessId: business.business_id,
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

  async getQuickSales(userId: number, date?: Date) {
    const business = await this.businessRepository.findOne({
      where: { owner: { id: userId } },
      select: { business_id: true },
    });
    if (!business) {
      throw new NotFoundException('Business not found');
    }
    const query = this.quickSalesRepository
      .createQueryBuilder('qs')
      .leftJoinAndSelect('qs.items', 'items')
      .where('qs.businessId = :businessId', {
        businessId: business.business_id,
      });

    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      query.andWhere('qs.createdAt BETWEEN :start AND :end', { start, end });
    }
    return query.orderBy('qs.createdAt', 'DESC').getMany();
  }
}
