import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BusinessEntity } from './entities/bussiness.entity';
import type { CreateBusinessDto } from './dto/bussiness.dto';
import type { UserEntity } from 'src/auth/entities/auth.entity';

@Injectable()
export class BusinessService {
  constructor(
    @InjectRepository(BusinessEntity)
    private readonly businessRepository: Repository<BusinessEntity>,
  ) {}

  async createBusiness(payload: CreateBusinessDto, userId: string) {
    const existingBusiness = await this.businessRepository.findOne({
      where: { panNumber: payload.panNumber },
    });
    if (existingBusiness) {
      throw new ConflictException('Business with this PAN already exists');
    }

    try {
      const business = this.businessRepository.create({
        business_name: payload.name,
        panNumber: payload.panNumber,
        owner: { id: userId } as unknown as UserEntity,
      });

      const savedBusiness = await this.businessRepository.save(business);

      return {
        business_id: savedBusiness.business_id,
        Business_Name: savedBusiness.business_name,
        owner: savedBusiness.owner,
        panNumber: savedBusiness.panNumber,
      };
    } catch (error) {
      throw new Error('Undefined error occurred while creating business');
    }
  }
}
