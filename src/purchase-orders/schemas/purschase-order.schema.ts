import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ _id: false })
class POItem {
  @Prop({ type: Types.ObjectId, ref: 'InventoryItem', required: true })
  itemId!: Types.ObjectId;

  @Prop({ required: true })
  quantityRequested!: number;

  @Prop({ default: 0 })
  quantityReceived!: number;

  @Prop({ required: true })
  unitPrice!: number;
}

@Schema({ timestamps: true })
export class PurchaseOrder extends Document {
  @Prop({ required: true, unique: true })
  poNumber!: string; // e.g., PO-2026-001

  @Prop({ type: Types.ObjectId, ref: 'Supplier', required: true })
  supplierId!: Types.ObjectId;

  @Prop({ type: [POItem], default: [] })
  items!: POItem[];

  @Prop({ 
    required: true, 
    enum: ['Draft', 'Sent', 'Partial', 'Received', 'Cancelled'], 
    default: 'Draft' 
  })
  status!: string;

  @Prop({ required: true, default: 0 })
  totalValue!: number;

  @Prop()
  notes?: string;
}

export const PurchaseOrderSchema = SchemaFactory.createForClass(PurchaseOrder);