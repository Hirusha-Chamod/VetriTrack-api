import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PurchaseOrdersService } from './purchase-orders.service';
import { PurchaseOrdersController } from './purchase-orders.controller';
import { PurchaseOrder, PurchaseOrderSchema } from './schemas/purschase-order.schema';
import { Supplier, SupplierSchema } from 'src/suppliers/schema/supplier.schema';


@Module({
  imports: [
     MongooseModule.forFeature([
  { name: PurchaseOrder.name, schema: PurchaseOrderSchema },
  { name: Supplier.name, schema: SupplierSchema }
]),
  ],
  controllers: [PurchaseOrdersController],
  providers: [PurchaseOrdersService],
  exports: [PurchaseOrdersService], // Exported to allow Inventory/Approvals to trigger POs
})
export class PurchaseOrdersModule {}