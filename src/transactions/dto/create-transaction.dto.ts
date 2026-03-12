import { IsNotEmpty, IsString, IsNumber, IsEnum, Min, IsOptional } from 'class-validator';

export class CreateTransactionDto {
  @IsNotEmpty()
  @IsString()
  itemId!: string;

  @IsOptional()
  @IsString()
  batchId?: string; 

  // NEW: Accept lot number and expiry date for RECEIVE transactions
  @IsOptional()
  @IsString()
  batchLotNumber?: string;

  @IsOptional()
  @IsString()
  expiryDate?: string;

  @IsNotEmpty()
  @IsEnum(['ISSUE', 'RECEIVE', 'ADJUSTMENT'])
  type!: string;

  @IsNumber()
  quantity!: number; 

  @IsOptional()
  @IsString()
  supplierId?: string;

  @IsOptional()
  @IsString()
  reason?: string; 
}