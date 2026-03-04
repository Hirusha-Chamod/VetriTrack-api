import { IsNotEmpty, IsString, IsNumber, IsEnum, Min } from 'class-validator';

export class CreateTransactionDto {
  @IsNotEmpty()
  @IsString()
  itemId!: string;

  @IsNotEmpty()
  @IsString()
  batchId!: string;

  @IsNotEmpty()
  @IsEnum(['ISSUE', 'RECEIVE', 'ADJUSTMENT'])
  type!: string;

  @IsNumber()
  @Min(1)
  quantity!: number;

  @IsString()
  reason?: string;
}