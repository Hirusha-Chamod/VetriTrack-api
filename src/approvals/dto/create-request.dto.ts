import { IsNotEmpty, IsString, IsNumber, IsEnum, Min } from 'class-validator';

export class CreateRequestDto {
  @IsNotEmpty()
  @IsString()
  itemId!: string; // Reference to the Item in the inventory

  @IsNotEmpty()
  @IsString()
  product!: string; // String name for easy display in the table

  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  quantity!: number;

  @IsNotEmpty()
  @IsString()
  supplier!: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @IsNotEmpty()
  @IsEnum(['high', 'medium', 'low'])
  urgency!: string;

  @IsNotEmpty()
  @IsString()
  reason!: string;
}