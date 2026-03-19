import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { InventoryItem, InventoryItemSchema } from './schemas/inventory-item.schema';
import { StockBatch, StockBatchSchema } from './schemas/stock-batch.schema';
import { AuthModule } from '../auth/auth.module'; 
import { Supplier, SupplierSchema } from 'src/suppliers/schema/supplier.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: InventoryItem.name, schema: InventoryItemSchema },
      { name: StockBatch.name, schema: StockBatchSchema },
      { name: Supplier.name, schema: SupplierSchema },
    ]),
    AuthModule, 
  ],
  controllers: [InventoryController],
  providers: [InventoryService],
})
export class InventoryModule {}