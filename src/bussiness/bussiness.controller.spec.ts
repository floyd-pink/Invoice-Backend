import { Test, TestingModule } from '@nestjs/testing';
import { BusinessController } from './bussiness.controller';
import { BusinessService } from './bussiness.service';
import { CreateBusinessDto } from './dto/bussiness.dto';
import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { SubscriptionStatus } from 'src/business-subscription/entities/business-subscription.entity';
import { PlanBillingCycle } from 'src/plans/enum/plan-type.enum';
import { UserEntity } from 'src/auth/entities/auth.entity';
const validCreateBusinessPayload: CreateBusinessDto = {
  name: 'Test Business',
  panNumber: '1233456789',
};
const activeUserId = '1';

function createMockBusinessService() {
  return {
    createBusiness: jest.fn(),
  };
}
type CreateBusinessResponse = Awaited<
  ReturnType<BusinessService['createBusiness']>
>;

const correctMockServiceResponse: CreateBusinessResponse = {
  business_id: 'correct-business-id',
  Business_Name: 'Test Business',

  owner: {
    id: 1,
    name: 'Test User',
  } as UserEntity,

  panNumber: '1233456789',

  subscription: {
    subscriptionId: 1,
    planId: 1,
    planName: 'Free Plan',

    billingCycle: PlanBillingCycle.MONTHLY,

    status: SubscriptionStatus.ACTIVE,

    startsAt: new Date('2026-01-01T00:00:00.000Z'),

    endsAt: null,
    nextBillingDate: null,
    lastBillingDate: null,
    nextPaymentAmount: null,
  },
};
describe('BusinessController', () => {
  let controller: BusinessController;
  let businessService: jest.Mocked<Pick<BusinessService, 'createBusiness'>>;
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: BusinessService,
          useValue: createMockBusinessService(),
        },
      ],
      controllers: [BusinessController],
    }).compile();

    controller = module.get<BusinessController>(BusinessController);
    businessService = module.get(BusinessService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
  describe('createBusiness', () => {
    it('should call businessService.createBusiness with correct parameters', async () => {
      await controller.createBusiness(validCreateBusinessPayload, activeUserId);

      expect(businessService.createBusiness).toHaveBeenCalledWith(
        validCreateBusinessPayload,
        activeUserId,
      );
      expect(businessService.createBusiness).toHaveBeenCalledTimes(1);
    });

    it('should stop execution and not call service if invalid payload is provided', async () => {
      const invalidPayload = {
        name: 'tes business',
        panNumber: '111',
      };
      const validationPipe = new ValidationPipe();

      await expect(
        validationPipe.transform(invalidPayload, {
          type: 'body',
          metatype: CreateBusinessDto,
        }),
      ).rejects.toThrow(BadRequestException);

      expect(businessService.createBusiness).not.toHaveBeenCalled();
    });
    it('should return service response as it is if service call is successful', async () => {
      businessService.createBusiness.mockResolvedValue(
        correctMockServiceResponse,
      );

      const result = await controller.createBusiness(
        validCreateBusinessPayload,
        activeUserId,
      );

      expect(result).toEqual(correctMockServiceResponse);

      expect(businessService.createBusiness).toHaveBeenCalledWith(
        validCreateBusinessPayload,
        activeUserId,
      );

      expect(businessService.createBusiness).toHaveBeenCalledTimes(1);
    });
    it('should throw error is activeUser session expires', async () => {
      businessService.createBusiness.mockRejectedValue(
        new Error('Active user session expired'),
      );
      await expect(
        controller.createBusiness(validCreateBusinessPayload, activeUserId),
      ).rejects.toThrow('Active user session expired');
      expect(businessService.createBusiness).toHaveBeenCalledWith(
        validCreateBusinessPayload,
        activeUserId,
      );
      expect(businessService.createBusiness).toHaveBeenCalledTimes(1);
    });
  });
});
