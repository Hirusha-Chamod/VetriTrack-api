import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Supplier extends Document {
  @Prop({ required: true, unique: true })
  supplierName!: string;

  @Prop({ required: true, enum: ['Active', 'Inactive'], default: 'Active' })
  status!: string;

  @Prop({ required: true })
  contactName!: string;

 @Prop({ required: true, unique: true })
  email!: string;

  @Prop({ required: true })
  phone!: string;

  @Prop({ required: true })
  address!: string;

  @Prop()
  notes?: string;

  @Prop()
  leadTimeNotes?: string;

  @Prop({ default: 0 })
  averageLeadTimeDays!: number;

  @Prop({ default: 0 })
  totalOrdersReceived!: number;

  @Prop({ type: [Types.ObjectId], ref: 'InventoryItem', default: [] })
  inventoryItemIds?: Types.ObjectId[];
}

export const SupplierSchema = SchemaFactory.createForClass(Supplier);