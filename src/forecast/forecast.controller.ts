import { Controller, Get, Param } from '@nestjs/common';
import { ForecastService } from './forecast.service';

@Controller('forecast')
export class ForecastController {
  constructor(private readonly forecastService: ForecastService) {}

  @Get('recommendations')
  async getRecommendations() {
    return this.forecastService.getRecommendations();
  }

  @Get('chart/:itemId')
  async getChartData(@Param('itemId') itemId: string) {
    return await this.forecastService.getChartData(itemId);
  }
}