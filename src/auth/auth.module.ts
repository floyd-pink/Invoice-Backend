import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtModule } from '@nestjs/jwt';
import { UserEntity } from './entities/auth.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity]),
    // Configure the JwtModule
    JwtModule.register({
      global: true,
      secret: 'Hahsh-jaewuhjhda[jdas', // 🔒 FORCE THIS EXACT STRING
      signOptions: { expiresIn: '1d' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
