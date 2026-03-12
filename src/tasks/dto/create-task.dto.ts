import { IsNotEmpty, IsString, IsEnum, IsDateString, IsOptional, IsMongoId } from 'class-validator';

export class CreateTaskDto {
  @IsNotEmpty()
  @IsString()
  title!: string;

  @IsNotEmpty()
  @IsString()
  description!: string;

  @IsNotEmpty()
  @IsMongoId()
  assignedTo!: string;

  @IsNotEmpty()
  @IsDateString()
  dueDate!: string;

  @IsOptional()
  @IsEnum(['low', 'medium', 'high'])
  priority?: string;

  @IsOptional()
  @IsEnum(['inventory', 'procurement', 'expiry', 'stock-count', 'general'])
  taskType?: string;

  // Linked records (Optional)
  @IsOptional()
  @IsEnum(['item', 'batch', 'po', 'request'])
  linkedRecordType?: string;

  @IsOptional()
  @IsMongoId()
  linkedRecordId?: string;

  @IsOptional()
  @IsString()
  linkedRecordName?: string;
}