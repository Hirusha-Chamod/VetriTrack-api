import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class InventoryItem extends Document {
  @Prop({ required: true, unique: true })
  itemCode!: string;

  @Prop({ required: true })
  itemName!: string;

  @Prop({ required: true })
  category!: string;

  @Prop({ required: true })
  unitOfMeasure!: string;

  @Prop({ required: true, default: 0 })
  minStockLevel!: number;

  @Prop({ required: true, default: 0 })
  unitPrice!: number;

  @Prop({ required: false })
  notes?: string;
}

export const InventoryItemSchema = SchemaFactory.createForClass(InventoryItem);