import { Test, TestingModule } from '@nestjs/testing';
import { BusinessService } from './bussiness.service';
import { CreateBusinessDto } from './dto/bussiness.dto';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { BusinessEntity } from '../bussiness/entities/bussiness.entity';
import { UserEntity } from '../auth/entities/auth.entity';
import { PlanEntity } from '../plans/entities/plan.entity';
import {
  BusinessSubscriptionEntity,
  SubscriptionStatus,
} from '../business-subscription/entities/business-subscription.entity';
import { DataSource } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RedisService } from '../common/redis/redis.service';
import { PlanType } from '../plans/enum/plan-type.enum';

const mockRepository = () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
});
const mockFreePlan = {
  id: 1,
  name: 'Free',
  price: 0,
  type: PlanType.FREE,
  billingCycle: 'Monthly',
  isActive: true,
};

const payload: CreateBusinessDto = {
  name: 'Test Business',
  panNumber: '1234567890',
};
const savedBusiness = {
  business_id: 'sty1234',
  business_name: 'Test Business',
  panNumber: '1234567890',
  walletBalance: 0,
  createdAt: new Date(),
  updatedAt: null,
  owner: { id: 1 } as UserEntity,
};
const savedSubscription = {
  business_id: 'sty1234',
  Business_Name: 'Test Business',
  owner: { id: 1 } as UserEntity,
  panNumber: '1234567890',
  subscription: {
    subscriptionId: 1,
    planId: 1,
    planName: 'Free',
    billingCycle: 'Monthly',
    status: SubscriptionStatus.ACTIVE,
    startsAt: expect.any(Date),
    endsAt: null,
    nextBillingDate: null,
    lastBillingDate: null,
    nextPaymentAmount: null,
  },
};
const mockSubscription = {
  subscriptionId: 1,
  business: savedBusiness,
  plan: mockFreePlan,
};
const mockQueryRunner = () => ({
  connect: jest.fn().mockResolvedValue(undefined),
  startTransaction: jest.fn().mockResolvedValue(undefined),
  commitTransaction: jest.fn().mockResolvedValue(undefined),
  rollbackTransaction: jest.fn().mockResolvedValue(undefined),
  release: jest.fn().mockResolvedValue(undefined),

  manager: {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  },
});
beforeEach(() => {
  jest.resetAllMocks();
});
describe('BusinessService', () => {
  let service: BusinessService;
  let mockBusinessRepository: ReturnType<typeof mockRepository>;
  let mockUserRepository: ReturnType<typeof mockRepository>;
  let mockPlanRepository: ReturnType<typeof mockRepository>;
  let mockSubscriptionRepository: ReturnType<typeof mockRepository>;
  let mockRedisService: {
    getCachedFreePlan: jest.Mock;
    setCachedFreePlan: jest.Mock;
  };
  let queryRunner: ReturnType<typeof mockQueryRunner>;
  beforeEach(async () => {
    mockBusinessRepository = mockRepository();
    mockUserRepository = mockRepository();
    mockPlanRepository = mockRepository();
    mockSubscriptionRepository = mockRepository();
    mockRedisService = {
      getCachedFreePlan: jest.fn(),
      setCachedFreePlan: jest.fn(),
    };
    queryRunner = mockQueryRunner();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BusinessService,

        {
          provide: getRepositoryToken(BusinessEntity),
          useValue: mockBusinessRepository,
        },

        {
          provide: getRepositoryToken(UserEntity),
          useValue: mockUserRepository,
        },

        {
          provide: getRepositoryToken(PlanEntity),
          useValue: mockPlanRepository,
        },

        {
          provide: getRepositoryToken(BusinessSubscriptionEntity),
          useValue: mockSubscriptionRepository,
        },

        {
          provide: DataSource,
          useValue: {
            createQueryRunner: jest.fn().mockReturnValue(queryRunner),
            transaction: jest.fn(),
          },
        },

        // Mock Redis
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    service = module.get<BusinessService>(BusinessService);
  });
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should throw ConflictException if business with same PAN exists', async () => {
    mockRedisService.getCachedFreePlan.mockResolvedValue(mockFreePlan);

    queryRunner.manager.findOne.mockResolvedValue({
      business_id: '123',
      panNumber: payload.panNumber,
    });

    await expect(service.createBusiness(payload, '1')).rejects.toThrow(
      new ConflictException('Business with this PAN already exists'),
    );

    expect(queryRunner.manager.findOne).toHaveBeenCalledWith(BusinessEntity, {
      where: { panNumber: payload.panNumber },
    });

    expect(queryRunner.connect).toHaveBeenCalledTimes(1);
    expect(queryRunner.startTransaction).toHaveBeenCalledTimes(1);

    expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);

    expect(queryRunner.commitTransaction).not.toHaveBeenCalled();

    expect(queryRunner.manager.save).not.toHaveBeenCalled();

    expect(queryRunner.release).toHaveBeenCalledTimes(1);
  });
  it('should only hit the database for free plan if not cached', async () => {
    mockRedisService.getCachedFreePlan.mockResolvedValue(undefined);

    mockPlanRepository.findOne.mockResolvedValue(mockFreePlan);
    queryRunner.manager.findOne.mockResolvedValue({
      business_id: '123',
      panNumber: payload.panNumber,
    });

    await expect(service.createBusiness(payload, '1')).rejects.toThrow(
      ConflictException,
    );

    expect(mockRedisService.getCachedFreePlan).toHaveBeenCalledTimes(1);
    expect(mockPlanRepository.findOne).toHaveBeenCalledWith({
      where: { type: PlanType.FREE, isActive: true },
    });
    expect(mockRedisService.setCachedFreePlan).toHaveBeenCalledWith(
      mockFreePlan,
    );
    expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
  });
  it('should throw NotFoundException id plan is not found or inactive ', async () => {
    mockRedisService.getCachedFreePlan.mockResolvedValue(undefined);
    mockPlanRepository.findOne.mockResolvedValue(undefined);
    await expect(service.createBusiness(payload, '1')).rejects.toThrow(
      new NotFoundException('Free plan not found.'),
    );
    await expect(mockRedisService.getCachedFreePlan).toHaveBeenCalledTimes(1);
    await expect(mockPlanRepository.findOne).toHaveBeenCalledWith({
      where: { type: PlanType.FREE, isActive: true },
    });
  });
  it('should rollback successfully when business creation and subscription plan is not achieved', async () => {
    const payload = {
      name: 'Test Business',
      panNumber: '123456789',
    };

    const mockBusiness = {
      business_name: payload.name,
      panNumber: payload.panNumber,
      owner: { id: 1 },
    };

    const mockSubscription = {
      subscriptionId: 1,
      business: savedBusiness,
      plan: mockFreePlan,
    };

    mockRedisService.getCachedFreePlan.mockResolvedValue(mockFreePlan);
    queryRunner.manager.findOne
      .mockReset()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    queryRunner.manager.findOne.mockImplementation((entity) => {
      if (entity == BusinessEntity) {
        return mockBusiness;
      }
      if (entity == BusinessSubscriptionEntity) {
        return mockSubscription;
      }
    });
    queryRunner.manager.save
      .mockReset()
      .mockResolvedValueOnce(savedBusiness)
      .mockRejectedValueOnce(new Error('Subscription creation failed'));

    await expect(service.createBusiness(payload, '1')).rejects.toThrow(
      'Subscription creation failed',
    );

    expect(queryRunner.manager.findOne).toHaveBeenCalledTimes(2);
    expect(queryRunner.manager.save).toHaveBeenCalledTimes(2);

    expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
    expect(queryRunner.release).toHaveBeenCalledTimes(1);
  });
  it('should create business and subscription successfully', async () => {
    const numericUsedId = 1;
    mockRedisService.getCachedFreePlan.mockResolvedValue(mockFreePlan);
    queryRunner.manager.findOne
      .mockReset()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    queryRunner.manager.create.mockReturnValueOnce(savedBusiness);
    queryRunner.manager.create.mockReturnValueOnce(mockSubscription);
    queryRunner.manager.save.mockResolvedValueOnce(savedBusiness);
    queryRunner.manager.save.mockResolvedValueOnce(mockSubscription);

    const result = await service.createBusiness(
      payload,
      numericUsedId.toString(),
    );
    expect(queryRunner.connect).toHaveBeenCalledTimes(1);
    expect(queryRunner.startTransaction).toHaveBeenCalledTimes(1);

    expect(queryRunner.manager.findOne).toHaveBeenCalledWith(BusinessEntity, {
      where: { panNumber: payload.panNumber },
    });

    expect(queryRunner.manager.create).toHaveBeenCalledTimes(2);
    expect(queryRunner.manager.save).toHaveBeenCalledTimes(2);
    expect(queryRunner.manager.save).toHaveBeenNthCalledWith(1, savedBusiness);
    expect(queryRunner.manager.save).toHaveBeenNthCalledWith(
      2,
      mockSubscription,
    );
    expect(queryRunner.commitTransaction).toHaveBeenCalledTimes(1);
    expect(queryRunner.rollbackTransaction).not.toHaveBeenCalled();
    expect(queryRunner.release).toHaveBeenCalledTimes(1);
    expect(result).toEqual(savedSubscription);
  });
});
