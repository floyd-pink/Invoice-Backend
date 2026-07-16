import { Test, TestingModule } from '@nestjs/testing';
import { BussinessController } from './bussiness.controller';

describe('BussinessController', () => {
  let controller: BussinessController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BussinessController],
    }).compile();

    controller = module.get<BussinessController>(BussinessController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
