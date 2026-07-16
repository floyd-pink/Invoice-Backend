import { IsEmail, IsNotEmpty, IsPhoneNumber, IsString } from 'class-validator';

export class RegisterCustomerDto {
  @IsString()
  @IsNotEmpty({ message: 'Customer Name is required ' })
  customer_name: string;

  @IsPhoneNumber(undefined, {
    message: 'Customer valid phone number is required ',
  })
  @IsNotEmpty({ message: 'Please enter Customer Number ' })
  customer_phone: string;

  @IsEmail({}, { message: 'Please provide valid email address' })
  @IsNotEmpty({ message: 'Please provide your email address' })
  customer_email: string;

}
