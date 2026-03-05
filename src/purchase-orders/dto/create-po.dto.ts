import { IsNotEmpty, IsMongoId, IsString, IsOptional } from 'class-validator';

export class CreatePoDto {
  @IsNotEmpty()
  @IsMongoId()
  supplierId!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}