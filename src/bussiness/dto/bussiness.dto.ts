import { IsNotEmpty, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateBusinessDto {
  @ApiProperty({ example: 'Acme Corporation', description: 'Business name' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({
    example: '123456789',
    description: 'PAN number (exactly 9 characters)',
  })
  @IsNotEmpty()
  @IsString()
  @Length(9, 9, { message: 'PAN number must be exactly 9 characters' })
  panNumber: string;
}
