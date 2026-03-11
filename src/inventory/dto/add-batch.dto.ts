import { IsNotEmpty, IsString, IsNumber, IsDateString, Min, IsMongoId } from 'class-validator';

export class AddBatchDto {
  @IsNotEmpty()
  @IsMongoId()
  itemId!: string;

  @IsNotEmpty()
  @IsString()
  batchCode!: string;

  @IsNotEmpty()
  @IsDateString()
  expiryDate!: string;

  @IsNumber()
  @Min(1)
  quantityOnHand!: number;

  @IsNotEmpty()
  @IsMongoId()
  supplier!: string;
}