import { Controller, Body, Post } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { LoginDto, RegisterDto } from '../auth/dto/auth.dto';
@Controller('auth')
export class AuthController {
  constructor(private readonly AuthService: AuthService) {}

  @Post('sign-up')
  async signUp(@Body() registerPayload: RegisterDto) {
    return this.AuthService.register(registerPayload);
  }

  @Post('login')
  async Login(@Body() LoginPayload: LoginDto) {
    return this.AuthService.Login(LoginPayload);
  }
}
