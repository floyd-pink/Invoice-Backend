import { Test, TestingModule } from '@nestjs/testing';
import { InvoiceItemsController } from './invoice_items.controller';
import { InvoiceItemsService } from './invoice_items.service';
import { JwtService } from '@nestjs/jwt';

describe('InvoiceItemsController', () => {
  let controller: InvoiceItemsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InvoiceItemsController],
      providers: [
        { provide: InvoiceItemsService, useValue: {} },
        { provide: JwtService, useValue: {} },
      ],
    }).compile();

    controller = module.get(InvoiceItemsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
