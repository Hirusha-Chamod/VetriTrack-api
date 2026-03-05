import { IsNotEmpty, IsString, IsNumber, IsDateString, Min, IsMongoId } from 'class-validator';

export class AddBatchDto {
  @IsNotEmpty()
  @IsString()
  itemId!: string; // Reference to the parent InventoryItem

  @IsNotEmpty()
  @IsString()
  batchCode!: string; // Unique identifier for the batch

  @IsNotEmpty()
  @IsDateString()
  expiryDate!: string; // ISO format date for FEFO sorting

  @IsNumber()
  @Min(1)
  quantityOnHand!: number; // Starting stock amount

  @IsNotEmpty()
  @IsMongoId()
  supplier!: string;
}