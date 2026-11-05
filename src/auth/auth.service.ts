// src/auth/auth.service.ts
import {
  Injectable,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from './entities/auth.entity';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { BusinessEntity } from 'src/bussiness/entities/bussiness.entity';
import { BusinessService } from 'src/bussiness/bussiness.service';
@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly jwtService: JwtService,
    @InjectRepository(BusinessEntity)
    private readonly businessRepository: Repository<BusinessEntity>,
    private readonly businessService: BusinessService,
  ) {}

  async register(registerPayload: RegisterDto) {
    const { name, email, phone, password } = registerPayload;

    const existingUser = await this.userRepository.findOne({
      where: [{ phone }],
    });
    if (existingUser) {
      throw new ConflictException('Phone number already exists');
    }

    try {
      const newUser = this.userRepository.create({
        name,
        email,
        phone,
      });
      newUser.password = password;

      const savedUser = await this.userRepository.save(newUser);

      return {
        id: savedUser.id,
        name: savedUser.name,
        email: savedUser.email,
        phone: savedUser.phone,
        role: savedUser.role,
        createdAt: savedUser.createdAt,
      };
    } catch {
      throw new InternalServerErrorException(
        'An error occurred during registration',
      );
    }
  }
  async Login(loginPayload: LoginDto) {
    const { email, password } = loginPayload;

    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      throw new NotFoundException(
        'User associated with the email does not exist',
      );
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid password');
    }

    const businesses = await this.businessRepository.find({
      where: { owner: { id: user.id } },
      select: { business_id: true, business_name: true },
    });
    const tokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      ...(businesses.length === 1
        ? { businessId: businesses[0].business_id }
        : {}),
    };

    const accessToken = this.jwtService.sign(tokenPayload);
    return {
      access_token: accessToken,
      requiresBusinessSelection: businesses.length > 1,
      businesses: businesses.map((b) => ({
        BusinessName: b.business_name,
        BusinessId: b.business_id,
      })),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }
  async selectBusiness(businessId: string, userId: number) {
    const allowed = await this.businessService.isMember(businessId, userId);
    if (!allowed) throw new ForbiddenException('Business not accessible');

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');
    const tokenPayload = {
      sub: userId,
      role: user.role,
      email: user.email,
      businessId: businessId,
    };
    const accessToken = this.jwtService.sign(tokenPayload);
    return {
      access_token: accessToken,
    };
  }
}
