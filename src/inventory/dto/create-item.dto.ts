import { IsNotEmpty, IsString, IsNumber, Min } from 'class-validator';

export class CreateItemDto {
  @IsNotEmpty()
  @IsString()
  itemName!: string;

  @IsNotEmpty()
  @IsString()
  category!: string;

  @IsNotEmpty()
  @IsString()
  unitOfMeasure!: string;

  @IsNumber()
  @Min(0)
  minStockLevel!: number; // Threshold for low stock alerts
}