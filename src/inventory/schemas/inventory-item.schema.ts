import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class InventoryItem extends Document {
  @Prop({ required: true })
  itemName!: string;

  @Prop({ required: true })
  category!: string;

  @Prop({ required: true })
  unitOfMeasure!: string;

  @Prop({ required: true, default: 0 })
  minStockLevel!: number; // R04: Reorder threshold
}

export const InventoryItemSchema = SchemaFactory.createForClass(InventoryItem);