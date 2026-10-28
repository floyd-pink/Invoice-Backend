import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';

const validRegisterPayload: RegisterDto = {
  name: 'Kc Ramesh',
  phone: '+9779865385541',
  email: 'kc@gmail.com',
  password: 'password123',
};

const validLoginPayload: LoginDto = {
  email: 'test@example.com',
  password: 'password123',
};

const mockRegisterResponse = {
  id: 'some-unique-id',
  name: 'Kc Ramesh',
  email: 'test@example.com',
  phone: '+9779865385541',
  role: 'user',
  createdAt: new Date(),
};

const mockLoginResponse = {
  access_token: 'mocked-jwt-token',
  user: {
    id: 'some-unique-id',
    name: 'Kc Ramesh',
    email: 'test@example.com',
    role: 'user',
  },
};

function createMockAuthService() {
  return {
    //they are same as methods in auth.service.ts same name and same payload
    register: jest.fn().mockResolvedValue(mockRegisterResponse),
    Login: jest.fn().mockResolvedValue(mockLoginResponse),
  };
}
describe('AuthController', () => {
  let controller: AuthController;
  let authService: ReturnType<typeof createMockAuthService>;

  beforeEach(async () => {
    authService = createMockAuthService();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('instantiation', () => {
    it('should be defined', () => {
      expect(controller).toBeDefined();
    });
  });

  describe('signUp', () => {
    it('should call AuthService.register with correct payload', async () => {
      await controller.signUp(validRegisterPayload);

      expect(authService.register).toHaveBeenCalledWith(validRegisterPayload);
      expect(authService.register).toHaveBeenCalledTimes(1);
    });
    it('should return value returned by AuthService.register', async () => {
      const result = await controller.signUp(validRegisterPayload);
      expect(result).toEqual(mockRegisterResponse);
    });

    it('should propagate errors thrown by AuthService.register', async () => {
      const error = new Error('Email already exists');

      authService.register.mockRejectedValueOnce(error);
      await expect(controller.signUp(validRegisterPayload)).rejects.toThrow(
        'Email already exists',
      );
    });
  });
  describe('Login', () => {
    it('should call AuthService.Login with Correct payload', async () => {
      await controller.Login(validLoginPayload);
      expect(authService.Login).toHaveBeenCalledWith(validLoginPayload);
      expect(authService.Login).toHaveBeenCalledTimes(1);
    });
    it('should return value returned by AuthService.Login', async () => {
      const result = await controller.Login(validLoginPayload);
      expect(result).toEqual(mockLoginResponse);
    });

    it('should return error thrown by AuthService.Login', async () => {
      const error = new Error('Invalid credentials');
      authService.Login.mockRejectedValueOnce(error);
      await expect(controller.Login(validLoginPayload)).rejects.toThrow(
        'Invalid credentials',
      );
    });
  });
});
