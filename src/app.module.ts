import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { InventoryModule } from './inventory/inventory.module';
import { TransactionsModule } from './transactions/transactions.module';
import { PurchaseOrdersModule } from './purchase-orders/purchase-orders.module';
import { ApprovalsModule } from './approvals/approvals.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { TasksModule } from './tasks/tasks.module';

@Module({
  imports: [

    ConfigModule.forRoot({
      isGlobal: true, 
    }),
    
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGO_URI'),
      }),
    }),
    
    InventoryModule,
    
    TransactionsModule,
    
    PurchaseOrdersModule,
    
    ApprovalsModule,
    
    SuppliersModule,

    TasksModule,
  ],
})
export class AppModule {}