import { IsEnum, IsNotEmpty, IsString, IsEmail, MinLength, IsOptional } from 'class-validator';

export class SignUpDto {
  @IsNotEmpty()
  @IsString()
  fullName!: string;

  @IsNotEmpty()
  @IsString()
  username!: string;

 
  @IsNotEmpty()
  @IsEmail() 
  email!: string; 

  @IsNotEmpty()
  @MinLength(6)
  password!: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  
  @IsNotEmpty()
  @IsEnum(['staff', 'owner'])
  role!: string;
}