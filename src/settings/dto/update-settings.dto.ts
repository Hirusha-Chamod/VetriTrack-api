import { IsNumber, IsIn, IsOptional, Min } from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional()
  @IsNumber()
  @IsIn([30, 90, 180], { message: 'Recommendation horizon must be exactly 30, 90, or 180 days.' })
  recommendationHorizonDays?: number;

  @IsOptional()
  @IsNumber()
  @Min(1, { message: 'Expiry alert must be at least 1 day.' })
  expiryAlertDays?: number;
}