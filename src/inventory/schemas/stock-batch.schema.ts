import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } })
export class StockBatch extends Document {
  @Prop({ type: Types.ObjectId, ref: 'InventoryItem', required: true })
  itemId!: Types.ObjectId;

  @Prop({ required: true })
  batchCode!: string; 

  @Prop({ required: true })
  expiryDate!: Date;

  @Prop({ required: true, default: 0 })
  quantityOnHand!: number;

  @Prop({ required: true })
  supplier!: string; 
}

export const StockBatchSchema = SchemaFactory.createForClass(StockBatch);

StockBatchSchema.virtual('status').get(function() {
  const now = new Date();
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(now.getDate() + 30);

  if (this.expiryDate <= now) return 'expired';
  if (this.expiryDate <= thirtyDaysFromNow) return 'warning';
  return 'good';
});