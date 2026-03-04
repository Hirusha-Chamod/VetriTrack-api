import { IsNotEmpty, IsString, IsNumber, IsDateString, Min } from 'class-validator';

export class AddBatchDto {
  @IsNotEmpty()
  @IsString()
  itemId!: string; // Reference to the InventoryItem ID

  @IsNotEmpty()
  @IsString()
  batchCode!: string;

  @IsNotEmpty()
  @IsDateString()
  expiryDate!: string; // Must be a valid ISO date string

  @IsNumber()
  @Min(1)
  quantityOnHand!: number;
}