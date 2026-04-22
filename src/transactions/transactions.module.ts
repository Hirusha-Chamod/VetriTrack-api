import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { InventoryModule } from '../inventory/inventory.module'; 
import { Transaction, TransactionSchema } from './schemas/transaction.schema';
import { StockBatch, StockBatchSchema } from '../inventory/schemas/stock-batch.schema';
import { InventoryItem, InventoryItemSchema } from '../inventory/schemas/inventory-item.schema';
import { Supplier, SupplierSchema } from '../suppliers/schema/supplier.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Transaction.name, schema: TransactionSchema },
      { name: StockBatch.name, schema: StockBatchSchema },
      { name: InventoryItem.name, schema: InventoryItemSchema },
      { name: Supplier.name, schema: SupplierSchema },
    ]),
    InventoryModule, 
  ],
  controllers: [TransactionsController],
  providers: [TransactionsService],
})
export class TransactionsModule {}