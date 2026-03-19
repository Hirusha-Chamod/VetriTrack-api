import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { StockBatch, StockBatchSchema } from '../inventory/schemas/stock-batch.schema'; 

import { Supplier, SupplierSchema } from '../suppliers/schema/supplier.schema'; 
import { PurchaseOrder, PurchaseOrderSchema } from 'src/purchase-orders/schemas/purschase-order.schema';

@Module({
  imports: [
    // Register the schemas the AnalyticsService needs to query
    MongooseModule.forFeature([
      { name: StockBatch.name, schema: StockBatchSchema },
      { name: PurchaseOrder.name, schema: PurchaseOrderSchema },
      { name: Supplier.name, schema: SupplierSchema },
    ]),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}