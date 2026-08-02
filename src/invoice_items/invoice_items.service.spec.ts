import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { InvoiceItemsService } from './invoice_items.service';
import { BusinessEntity } from 'src/bussiness/entities/bussiness.entity';
import { BusinessCustomer } from 'src/business-customer/entities/business-customer.entity';

describe('InvoiceItemsService', () => {
  let service: InvoiceItemsService;

  const mockBusinessRepository = {
    findOne: jest.fn(),
  };

  const mockBusinessCustomerRepository = {
    findOne: jest.fn(),
  };

  const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      create: jest.fn(),
      save: jest.fn(),
    },
  };

  const mockDataSource = {
    createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoiceItemsService,
        {
          provide: getRepositoryToken(BusinessEntity),
          useValue: mockBusinessRepository,
        },
        {
          provide: getRepositoryToken(BusinessCustomer),
          useValue: mockBusinessCustomerRepository,
        },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get(InvoiceItemsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createInvoice', () => {
    const businessId = 'biz-1';
    const userId = 42;

    const payload = {
      customer_id: 'cust-1',
      notes: 'test invoice',
      paid_amount: 20,
      items: [
        { item_name: 'Widget', item_quantity: 2, item_price: 10 },
        { item_name: 'Gadget', item_quantity: 1, item_price: 30 },
      ],
    };

    const fakeBusiness = { business_id: businessId, owner: { id: userId } };
    const fakeCustomer = {
      customerId: 'cust-1',
      customer: { id: 'cust-1', name: 'pink-floyd' },
    };

    it('should throw NotFoundException if business does not exist', async () => {
      mockBusinessRepository.findOne.mockResolvedValue(null);

      await expect(
        service.createInvoice(payload as any, businessId, userId),
      ).rejects.toThrow(NotFoundException);

      // transaction should never even start
      expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException if user is not the business owner', async () => {
      mockBusinessRepository.findOne.mockResolvedValue({
        business_id: businessId,
        owner: { id: 999 },
      });

      await expect(
        service.createInvoice(payload as any, businessId, userId),
      ).rejects.toThrow(ForbiddenException);

      expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if customer does not belong to business', async () => {
      mockBusinessRepository.findOne.mockResolvedValue(fakeBusiness);
      mockBusinessCustomerRepository.findOne.mockResolvedValue(null);

      await expect(
        service.createInvoice(payload as any, businessId, userId),
      ).rejects.toThrow(NotFoundException);

      expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
    });

    it('should calculate totals correctly and commit the transaction on success', async () => {
      mockBusinessRepository.findOne.mockResolvedValue(fakeBusiness);
      mockBusinessCustomerRepository.findOne.mockResolvedValue(fakeCustomer);

      const fakeInvoice = { id: 'invoice-1' };
      mockQueryRunner.manager.create.mockImplementation((entity, data) => data);
      mockQueryRunner.manager.save.mockResolvedValue(fakeInvoice);

      const result = await service.createInvoice(
        payload as any,
        businessId,
        userId,
      );

      expect(mockQueryRunner.manager.create).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          totalAmount: 50,
          paidAmount: 20,
          dueAmount: 30,
        }),
      );

      expect(mockQueryRunner.connect).toHaveBeenCalled();
      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.rollbackTransaction).not.toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
      expect(result).toEqual(
        expect.objectContaining({ message: 'Invoice created Successfully' }),
      );
    });

    it('should default dueAmount to totalAmount when paid_amount is not provided', async () => {
      const payloadNoPaid = { ...payload, paid_amount: undefined };
      mockBusinessRepository.findOne.mockResolvedValue(fakeBusiness);
      mockBusinessCustomerRepository.findOne.mockResolvedValue(fakeCustomer);
      mockQueryRunner.manager.create.mockImplementation((entity, data) => data);
      mockQueryRunner.manager.save.mockResolvedValue({ id: 'invoice-1' });

      await service.createInvoice(payloadNoPaid as any, businessId, userId);

      expect(mockQueryRunner.manager.create).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ paidAmount: 0, dueAmount: 50 }),
      );
    });

    it('should rollback and release if save throws mid-transaction', async () => {
      mockBusinessRepository.findOne.mockResolvedValue(fakeBusiness);
      mockBusinessCustomerRepository.findOne.mockResolvedValue(fakeCustomer);
      mockQueryRunner.manager.create.mockImplementation((entity, data) => data);
      mockQueryRunner.manager.save.mockRejectedValue(
        new Error('DB write failed'),
      );

      await expect(
        service.createInvoice(payload as any, businessId, userId),
      ).rejects.toThrow('DB write failed');

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).not.toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });
  });
});
