import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ _id: false })
export class POItem {
  @Prop({ type: Types.ObjectId, ref: 'InventoryItem', required: true })
  itemId!: Types.ObjectId;

  @Prop({ required: true })
  quantityRequested!: number;

  @Prop({ default: 0 })
  quantityReceived!: number;

  @Prop({ required: true })
  unitPrice!: number;

  // 👇 MOVED DISCOUNT FIELDS TO ITEM LEVEL
  @Prop({ enum: ['Percentage', 'Value', 'None'], default: 'None' })
  discountType!: string;

  @Prop({ default: 0 })
  discountValue!: number;

  @Prop({ required: true, default: 0 })
  lineTotal!: number; // The final cost of this specific item
}

@Schema({ timestamps: true })
export class PurchaseOrder extends Document {
  @Prop({ required: true, unique: true })
  poNumber!: string;

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

  // 👇 ROOT TOTALS
  @Prop({ required: true, default: 0 })
  totalValue!: number; // Sum of original prices (Quantity * Unit Price)

  @Prop({ required: true, default: 0 })
  finalTotalValue!: number; // Sum of all item lineTotals (after discounts)

  @Prop()
  notes?: string;

  @Prop()
  sentAt?: Date;

  @Prop()
  lastReminderSentAt?: Date;
}

export const PurchaseOrderSchema = SchemaFactory.createForClass(PurchaseOrder);