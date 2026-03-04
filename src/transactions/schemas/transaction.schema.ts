import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Transaction extends Document {
  @Prop({ type: Types.ObjectId, ref: 'InventoryItem', required: true })
  itemId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'StockBatch', required: true })
  batchId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  performedBy!: Types.ObjectId;

  @Prop({ required: true, enum: ['ISSUE', 'RECEIVE', 'ADJUSTMENT'] })
  type!: string;

  @Prop({ required: true })
  quantity!: number;

  @Prop()
  reason?: string;
}

export const TransactionSchema = SchemaFactory.createForClass(Transaction);