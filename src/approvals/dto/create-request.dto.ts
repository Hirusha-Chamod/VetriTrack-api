import { IsNotEmpty, IsString, IsNumber, IsEnum, Min, IsMongoId } from 'class-validator';

export class CreateRequestDto {
  @IsNotEmpty()
  @IsMongoId()
  itemId!: string;

  @IsNotEmpty()
  @IsString()
  product!: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  quantity!: number;

  @IsNotEmpty()
  @IsMongoId()
  supplierId!: string;

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