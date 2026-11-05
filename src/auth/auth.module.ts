import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtModule } from '@nestjs/jwt';
import { UserEntity } from './entities/auth.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BusinessModule } from 'src/bussiness/bussiness.module';
import { BusinessEntity } from 'src/bussiness/entities/bussiness.entity';

@Module({
  imports: [
    ConfigModule, // already global, safe to re-import for registerAsync
    TypeOrmModule.forFeature([UserEntity, BusinessEntity]),
    BusinessModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret:
          configService.get<string>('JWT_SECRET') || 'Hahsh-jaewuhjhda[jdas',
        signOptions: { expiresIn: '1d' },
      }),
      global: true,
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [JwtModule],
})
export class AuthModule {}
