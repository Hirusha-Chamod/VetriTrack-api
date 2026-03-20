import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HttpModule } from '@nestjs/axios';
import { ForecastController } from './forecast.controller';
import { ForecastService } from './forecast.service';
import { InventoryItem, InventoryItemSchema } from '../inventory/schemas/inventory-item.schema';
import { StockBatch, StockBatchSchema } from '../inventory/schemas/stock-batch.schema';
import { Transaction, TransactionSchema } from '../transactions/schemas/transaction.schema';
import { SettingsModule } from 'src/settings/settings.module';

@Module({
  imports: [
    HttpModule, 
    MongooseModule.forFeature([
      { name: InventoryItem.name, schema: InventoryItemSchema },
      { name: StockBatch.name, schema: StockBatchSchema },
      { name: Transaction.name, schema: TransactionSchema },
    ]),
    SettingsModule,
  ],
  controllers: [ForecastController],
  providers: [ForecastService],
})
export class ForecastModule {}