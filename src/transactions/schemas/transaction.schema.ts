import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Transaction extends Document {
  @Prop({ type: Types.ObjectId, ref: 'InventoryItem', required: true })
  itemId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'StockBatch' })
  batchId?: Types.ObjectId; // Optional for multi-batch FEFO issues

  @Prop({ required: true, enum: ['RECEIVE', 'ISSUE', 'ADJUSTMENT'] })
  type!: string; // Matches your three UI cards

  @Prop({ required: true })
  quantity!: number;

  @Prop({ required: true })
  reason!: string; // e.g., "New Delivery", "FEFO Sale", "Damaged"

  @Prop()
  performedBy!: string; // User ID or Name from JWT
}

export const TransactionSchema = SchemaFactory.createForClass(Transaction);