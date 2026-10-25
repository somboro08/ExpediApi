import { IsEmail, IsOptional, IsString, MaxLength, Matches } from 'class-validator';

export class LoginDto {
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[+0-9 ()-]{8,20}$/)
  phone?: string;

  @IsString()
  @MaxLength(128)
  password!: string;
}
