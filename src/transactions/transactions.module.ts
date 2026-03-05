import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { InventoryModule } from '../inventory/inventory.module'; 
import { Transaction, TransactionSchema } from './schemas/transaction.schema';
import { StockBatch, StockBatchSchema } from '../inventory/schemas/stock-batch.schema'; // added import

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Transaction.name, schema: TransactionSchema },
      { name: StockBatch.name, schema: StockBatchSchema }, 
    ]),
    InventoryModule, 
  ],
  controllers: [TransactionsController],
  providers: [TransactionsService],
})
export class TransactionsModule {}