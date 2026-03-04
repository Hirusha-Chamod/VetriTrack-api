import { IsNotEmpty, IsString, IsNumber, IsEnum, Min, IsOptional } from 'class-validator';

export class CreateTransactionDto {
  @IsNotEmpty()
  @IsString()
  itemId!: string; // The product being moved

  @IsOptional()
  @IsString()
  batchId?: string; // Specific batch (Optional for FEFO which auto-selects)

  @IsNotEmpty()
  @IsEnum(['ISSUE', 'RECEIVE', 'ADJUSTMENT'])
  type!: string; // Matches your three UI cards

  @IsNumber()
  @Min(1)
  quantity!: number; // Amount being moved or adjusted

  @IsOptional()
  @IsString()
  reason?: string; // e.g., "Damaged goods" or "Monthly count"
}