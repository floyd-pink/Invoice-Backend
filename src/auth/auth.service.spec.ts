import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { UserEntity } from './entities/auth.entity';
import { JwtService } from '@nestjs/jwt';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import * as bcrypt from 'bcryptjs';

import {
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

jest.mock('bcryptjs');

function createValidRegisterPayload(): RegisterDto {
  return {
    name: 'KC Ramesh',
    email: 'kc@gmail.com',
    phone: '+9779841196067',
    password: 'password123',
  };
}

function createLoginPayload(): LoginDto {
  return {
    email: 'kc@gmail.com',
    password: 'password123',
  };
}

//this is what database will return
//overrides helps us change specific properties for different tests
function createMockUser(overrides: Partial<UserEntity> = {}): UserEntity {
  return Object.assign(new UserEntity(), {
    id: 1,
    name: 'KC Ramesh',
    email: 'kc@gmail.com',
    passwordHash: 'hashedPassword',
    phone: '+9779841196067',
    role: 'user' as const,
    isActive: true,
    createdAt: new Date('2026-06-30'),
    updatedAt: new Date('2026-06-30'),
    businesses: [],
    ...overrides,
  });
}
function loginResponseMock() {
  return {
    access_token: 'mocked-jwt-token',
    user: {
      id: 1,
      name: 'Kc Ramesh',
      email: 'kc@gmail.com',
      role: 'user',
    },
  };
}
//mocking type orm repository methods that are being used in auth.service.ts

function createMockRepository() {
  return {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };
}
//creating a mock jwt token service which returns a mocked token
function createMockJwtService() {
  return {
    sign: jest.fn().mockReturnValue('mocked-jwt-token'),
  };
}

describe('AuthService', () => {
  let service: AuthService;
  let mockRepository: ReturnType<typeof createMockRepository>;
  let mockJwtService: ReturnType<typeof createMockJwtService>;

  //this gives us access to Jest methods on mocked bcrypt functions
  let mockBcrypt: jest.Mocked<typeof bcrypt>;

  beforeEach(async () => {
    //creating fresh mock dependencies before every test
    mockRepository = createMockRepository();
    mockJwtService = createMockJwtService();

    mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

    //clearing previous mock calls so tests don't affect each other
    jest.clearAllMocks();

    //by default we assume bcrypt.compare() returns true
    //individual tests can change it to false
    mockBcrypt.compare.mockResolvedValue(true as never);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          //providing fake repository instead of real TypeORM repository
          provide: getRepositoryToken(UserEntity),
          useValue: mockRepository,
        },
        {
          //providing fake JwtService instead of real JwtService
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    //getting the real AuthService from the testing module
    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should register a new User Successfully and return correct response', async () => {
      const registerPayload = createValidRegisterPayload();
      const savedUser = createMockUser({ id: 2 });

      //null means database did not find an existing user
      mockRepository.findOne.mockResolvedValue(null);

      //returning an actual UserEntity instance like TypeORM create()
      mockRepository.create.mockImplementation((data: Partial<UserEntity>) => {
        return Object.assign(new UserEntity(), data);
      });

      //pretending database saved the user and returned savedUser
      mockRepository.save.mockResolvedValue(savedUser);

      //calling our actual register method
      const result = await service.register(registerPayload);

      //service must return the same data as savedUser but without passwordHash and businesses
      expect(result).toEqual({
        id: savedUser.id,
        name: savedUser.name,
        email: savedUser.email,
        role: savedUser.role,
        phone: savedUser.phone,
        createdAt: savedUser.createdAt,
      });

      //checking whether findOne was called with the user's phone
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: [{ phone: registerPayload.phone }],
      });
      expect(mockRepository.findOne).toHaveBeenCalledTimes(1);

      expect(mockRepository.create).toHaveBeenCalledTimes(1);
      expect(mockRepository.create).toHaveBeenCalledWith({
        name: registerPayload.name,
        email: registerPayload.email,
        phone: registerPayload.phone,
      });

      //checking that password was assigned before calling save()

      expect(mockRepository.save).toHaveBeenCalledTimes(1);
      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          name: registerPayload.name,
          email: registerPayload.email,
          phone: registerPayload.phone,
          password: registerPayload.password,
        }),
      );

      //checking that sensitive fields are not returned to the client
      expect(result).not.toHaveProperty('password');
      expect(result).not.toHaveProperty('passwordHash');
      expect(result).not.toHaveProperty('businesses');
    });

    it('should throw ConflictException if phone number already exists', async () => {
      const registerPayload = createValidRegisterPayload();

      //this represents a user already existing in the database
      const existingUser = createMockUser();

      mockRepository.findOne.mockResolvedValue(existingUser);

      //calling register and checking the exception and message
      await expect(service.register(registerPayload)).rejects.toThrow(
        new ConflictException('Phone number already exists'),
      );

      //since the phone number exists, we should not create or save user
      expect(mockRepository.create).not.toHaveBeenCalled();
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException when repository.save fails', async () => {
      const registerPayload = createValidRegisterPayload();

      mockRepository.findOne.mockResolvedValue(null);

      //creating an entity so our service can assign password to it
      mockRepository.create.mockImplementation((data: Partial<UserEntity>) => {
        return Object.assign(new UserEntity(), data);
      });

      //pretending database connection fails while saving
      mockRepository.save.mockRejectedValue(new Error('DB connection failed'));

      //service should catch this error and throw InternalServerErrorException
      await expect(service.register(registerPayload)).rejects.toThrow(
        new InternalServerErrorException(
          'An error occurred during registration',
        ),
      );

      expect(mockRepository.save).toHaveBeenCalledTimes(1);
    });

    it('should throw InternalServerErrorException when repository.create fails', async () => {
      const registerPayload = createValidRegisterPayload();

      mockRepository.findOne.mockResolvedValue(null);

      //forcing repository.create to throw an error
      mockRepository.create.mockImplementation(() => {
        throw new Error('Invalid entity data');
      });

      //service should catch this error and throw InternalServerErrorException
      await expect(service.register(registerPayload)).rejects.toThrow(
        InternalServerErrorException,
      );

      //save should not be called because creating user failed
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('should propagate database error when checking existing phone fails', async () => {
      const registerPayload = createValidRegisterPayload();

      mockRepository.findOne.mockRejectedValue(
        new Error('Database lookup failed'),
      );

      //so the original database error should be thrown
      await expect(service.register(registerPayload)).rejects.toThrow(
        'Database lookup failed',
      );

      expect(mockRepository.create).not.toHaveBeenCalled();
      expect(mockRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('Login', () => {
    it('should login successfully and return a valid token', async () => {
      const loginPayload = createLoginPayload();
      const mockUser = createMockUser();
      const tokenPayload = {
        sub: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
      };

      mockRepository.findOne.mockResolvedValue(mockUser);

      mockBcrypt.compare.mockResolvedValue(true as never);

      const result = await service.Login(loginPayload);

      expect(mockRepository.findOne).toHaveBeenCalledTimes(1);

      expect(mockBcrypt.compare).toHaveBeenCalledWith(
        loginPayload.password,
        mockUser.passwordHash,
      );

      expect(mockBcrypt.compare).toHaveBeenCalledTimes(1);

      expect(mockJwtService.sign).toHaveBeenCalledWith(tokenPayload);

      expect(mockJwtService.sign).toHaveBeenCalledTimes(1);

      expect(result).toEqual({
        access_token: 'mocked-jwt-token',
        user: {
          id: mockUser.id,
          name: mockUser.name,
          email: mockUser.email,
          role: mockUser.role,
        },
      });

      expect(result).not.toHaveProperty('password');
      expect(result.user).not.toHaveProperty('passwordHash');
    });
    it('should throw NotFoundException if user does not exist', async () => {
      //arrange
      const loginPayload = createLoginPayload();

      mockRepository.findOne.mockResolvedValue(null);
      //act
      const result = service.Login(loginPayload);
      //assert
      await expect(result).rejects.toThrow(NotFoundException);

      expect(mockRepository.findOne).toHaveBeenCalledTimes(1);

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { email: loginPayload.email },
      });
    });
    it('should throw UnauthorizedException if password is invalid', async () => {
      const loginPayload = createLoginPayload();
      const mockUser = createMockUser();

      mockRepository.findOne.mockResolvedValue(mockUser);
      mockBcrypt.compare.mockResolvedValue(false as never);

      const result = service.Login(loginPayload);

      await expect(result).rejects.toThrow(
        new UnauthorizedException('Invalid password'),
      );

      expect(mockRepository.findOne).toHaveBeenCalledTimes(1);
      expect(mockBcrypt.compare).toHaveBeenCalledWith(
        loginPayload.password,
        mockUser.passwordHash,
      );
      expect(mockBcrypt.compare).toHaveBeenCalledTimes(1);
    });
    it('should propagate database error when checking user by email fails on database', async () => {
      const loginPayload = createLoginPayload();
      mockRepository.findOne.mockRejectedValue(new Error('Database failure'));

      const result = service.Login(loginPayload);

      await expect(result).rejects.toThrow('Database failure');
      expect(mockRepository.findOne).toHaveBeenCalledTimes(1);
    });
  });
});
