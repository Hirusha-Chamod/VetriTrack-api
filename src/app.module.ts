import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailerModule } from '@nestjs-modules/mailer'; // 👈 NEW IMPORT

import { InventoryModule } from './inventory/inventory.module';
import { TransactionsModule } from './transactions/transactions.module';
import { PurchaseOrdersModule } from './purchase-orders/purchase-orders.module';
import { ApprovalsModule } from './approvals/approvals.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { TasksModule } from './tasks/tasks.module';
import { ForecastModule } from './forecast/forecast.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { SettingsModule } from './settings/settings.module';

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


    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        transport: {
          host: 'smtp.gmail.com',
          port: 587,
          secure: false, // true for 465, false for other ports like 587
          auth: {
            user: configService.get<string>('EMAIL_USER'), 
            pass: configService.get<string>('EMAIL_PASS'), 
          },
        },
        defaults: {
          from: '"VETRITRACK Purchasing" <noreply@vetritrack.com>',
        },
      }),
    }),
    
    InventoryModule,
    TransactionsModule,
    PurchaseOrdersModule,
    ApprovalsModule,
    SuppliersModule,
    TasksModule,
    ForecastModule,
    AnalyticsModule,
    SettingsModule,
  ],
})
export class AppModule {}