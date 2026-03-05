import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ApprovalsService } from './approvals.service';
import { ApprovalsController } from './approvals.controller';
import { ApprovalRequest, ApprovalRequestSchema } from './schemas/request.schema';
import { PurchaseOrdersModule } from '../purchase-orders/purchase-orders.module';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: ApprovalRequest.name, schema: ApprovalRequestSchema }]),
    PurchaseOrdersModule, 
    AuthModule
  ],
  controllers: [ApprovalsController],
  providers: [ApprovalsService],
})
export class ApprovalsModule {}