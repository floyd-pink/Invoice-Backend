import { Controller, Body, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { LoginDto, RegisterDto } from '../auth/dto/auth.dto';
import { Public } from 'src/common/decorators/public.decorator';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly AuthService: AuthService) {}

  @Public()
  @Post('sign-up')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  async signUp(@Body() registerPayload: RegisterDto) {
    return this.AuthService.register(registerPayload);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login user and get JWT token' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: 'Login successful', schema: { example: { access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' } } })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async Login(@Body() LoginPayload: LoginDto) {
    return this.AuthService.Login(LoginPayload);
  }
}
