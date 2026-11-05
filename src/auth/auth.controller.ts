import {
  Controller,
  Body,
  Post,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { LoginDto, RegisterDto } from '../auth/dto/auth.dto';
import { Public } from 'src/common/decorators/public.decorator';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { SkipBusinessContext } from 'src/common/decorators/skip-business-context.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { ActiveUser } from 'src/common/decorators/active-user.decorator';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly AuthService: AuthService) {}

  @Public()
  @SkipBusinessContext()
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
  @SkipBusinessContext()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login user and get JWT token' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    schema: {
      example: { access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async Login(@Body() LoginPayload: LoginDto) {
    return this.AuthService.Login(LoginPayload);
  }

  @SkipBusinessContext()
  @UseGuards(JwtAuthGuard)
  @Post('select-business')
  @ApiOperation({
    summary:
      'select a business for the user if multiple businesses are associated with the user',
  })
  async selectBusiness(
    @Body() body: { businessId: string },
    @ActiveUser('sub') userId: string,
  ) {
    return this.AuthService.selectBusiness(body.businessId, Number(userId));
  }
}
