import { IsString, IsEnum, IsOptional } from 'class-validator';

export class UpdateTaskDto {
  @IsOptional()
  @IsEnum(['assigned', 'in-progress', 'completed', 'cancelled'])
  status?: string;

  @IsOptional()
  @IsString()
  cancelReason?: string;
}