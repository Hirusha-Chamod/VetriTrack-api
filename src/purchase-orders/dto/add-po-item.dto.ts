import { IsNotEmpty, IsMongoId, IsNumber, Min } from 'class-validator';

export class AddPoItemDto {
  @IsNotEmpty()
  @IsMongoId()
  itemId!: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  quantity!: number;

  @IsNotEmpty()
  @IsNumber()
  unitPrice!: number;
}