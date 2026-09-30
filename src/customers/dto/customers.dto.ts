import { IsEmail, IsNotEmpty, IsPhoneNumber, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterCustomerDto {
  @ApiProperty({ example: 'Jane Smith', description: 'Customer full name' })
  @IsString()
  @IsNotEmpty({ message: 'Customer Name is required ' })
  customer_name: string;

  @ApiProperty({
    example: '+1234567890',
    description: 'Customer phone number with country code',
  })
  @IsPhoneNumber(undefined, {
    message: 'Customer valid phone number is required ',
  })
  @IsNotEmpty({ message: 'Please enter Customer Number ' })
  customer_phone: string;

  @ApiProperty({ example: 'jane@example.com', description: 'Customer email' })
  @IsEmail({}, { message: 'Please provide valid email address' })
  @IsNotEmpty({ message: 'Please provide your email address' })
  customer_email: string;
}
