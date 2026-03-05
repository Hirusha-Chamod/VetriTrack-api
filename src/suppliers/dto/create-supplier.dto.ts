import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateSupplierDto {
  @IsNotEmpty()
  @IsString()
  supplierName!: string;

  @IsEnum(['Active', 'Inactive'])
  @IsOptional()
  status?: string;

  @IsNotEmpty()
  @IsString()
  contactName!: string;

  @IsEmail()
  email!: string;

  @IsNotEmpty()
  @IsString()
  phone!: string;

  @IsNotEmpty()
  @IsString()
  address!: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  leadTimeNotes?: string;
}