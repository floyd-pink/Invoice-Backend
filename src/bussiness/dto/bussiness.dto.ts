import { IsNotEmpty, IsString, Length } from 'class-validator';

export class CreateBusinessDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  @Length(9, 9, { message: 'PAN number must be exactly 9 characters' })
  panNumber: string;
}
