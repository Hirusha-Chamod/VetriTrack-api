import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Task extends Document {
  @Prop({ required: true })
  title!: string;

  @Prop({ required: true })
  description!: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  assignedTo!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy!: Types.ObjectId;

  @Prop({ required: true })
  dueDate!: Date;

  @Prop({ 
    enum: ['assigned', 'in-progress', 'completed', 'cancelled'], 
    default: 'assigned' 
  })
  status!: string;

  @Prop({ enum: ['low', 'medium', 'high'] })
  priority?: string;

  @Prop({ enum: ['inventory', 'procurement', 'expiry', 'stock-count', 'general'] })
  taskType?: string;

  @Prop()
  cancelReason?: string;

  // Optional fields for when a task is linked to a specific item or PO
  @Prop({ enum: ['item', 'batch', 'po', 'request'] })
  linkedRecordType?: string;

  @Prop({ type: Types.ObjectId })
  linkedRecordId?: Types.ObjectId;

  @Prop()
  linkedRecordName?: string;
}

export const TaskSchema = SchemaFactory.createForClass(Task);