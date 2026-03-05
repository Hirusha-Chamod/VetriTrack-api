import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PurchaseOrdersService } from './purchase-orders.service';
import { PurchaseOrdersController } from './purchase-orders.controller';
import { PurchaseOrder, PurchaseOrderSchema } from './schemas/purschase-order.schema';


@Module({
  imports: [
    // Connects the schema to the Mongoose database
    MongooseModule.forFeature([
      { name: PurchaseOrder.name, schema: PurchaseOrderSchema }
    ]),
  ],
  controllers: [PurchaseOrdersController],
  providers: [PurchaseOrdersService],
  exports: [PurchaseOrdersService], // Exported to allow Inventory/Approvals to trigger POs
})
export class PurchaseOrdersModule {}