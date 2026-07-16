import { Test, TestingModule } from '@nestjs/testing';
import { InvoiceItemsService } from './invoice_items.service';

describe('InvoiceItemsService', () => {
  let service: InvoiceItemsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [InvoiceItemsService],
    }).compile();

    service = module.get<InvoiceItemsService>(InvoiceItemsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
