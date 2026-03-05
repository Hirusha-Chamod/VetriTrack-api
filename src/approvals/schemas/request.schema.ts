import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true }) // Automatically adds createdAt and updatedAt
export class ApprovalRequest extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  requestedBy!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Item', required: true })
  itemId!: Types.ObjectId;

  @Prop({ required: true })
  product!: string;

  @Prop({ required: true })
  quantity!: number;

  @Prop({ required: true })
  supplier!: string;

  @Prop({ required: true })
  unitPrice!: number;

  @Prop({ required: true })
  totalAmount!: number;

  @Prop({ required: true, enum: ['high', 'medium', 'low'], default: 'low' })
  urgency!: string;

  @Prop({ required: true })
  reason!: string;

  @Prop({ 
    required: true, 
    enum: ['pending', 'approved', 'rejected'], 
    default: 'pending' 
  })
  status!: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  reviewedBy?: Types.ObjectId;
}

export const ApprovalRequestSchema = SchemaFactory.createForClass(ApprovalRequest);