// auth.dto.ts
import {
  IsEmail,
  IsString,
  IsNotEmpty,
  MinLength,
  IsPhoneNumber,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'John Doe', description: 'User full name' })
  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  name: string;

  @ApiProperty({
    example: '+1234567890',
    description: 'Phone number with country code',
  })
  @IsPhoneNumber(undefined, {
    message:
      'Please provide a valid phone Number associated with the country code',
  })
  @IsNotEmpty({ message: 'Phone number is required' })
  phone: string;

  @ApiProperty({ example: 'john@example.com', description: 'User email' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @ApiProperty({ example: 'password123', description: 'Password (min 6 chars)' })
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  password: string;
}

export class LoginDto {
  @ApiProperty({ example: 'john@example.com', description: 'User email' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @ApiProperty({ example: 'password123', description: 'User password' })
  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  password: string;
}
