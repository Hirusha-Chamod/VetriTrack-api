import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class StockBatch extends Document {
  @Prop({ type: Types.ObjectId, ref: 'InventoryItem', required: true })
  itemId!: Types.ObjectId;

  @Prop({ required: true })
  batchCode!: string;

  @Prop({ required: true })
  expiryDate!: Date; // Used for FEFO sorting

  @Prop({ required: true, default: 0 })
  quantityOnHand!: number;

  @Prop({ default: false })
  isExpired!: boolean;
}

export const StockBatchSchema = SchemaFactory.createForClass(StockBatch);