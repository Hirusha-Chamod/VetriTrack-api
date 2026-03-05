import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Supplier extends Document {
  @Prop({ required: true, unique: true })
  supplierName!: string;

  @Prop({ required: true, enum: ['Active', 'Inactive'], default: 'Active' })
  status!: string;

  @Prop({ required: true })
  contactName!: string;

  @Prop({ required: true })
  email!: string;

  @Prop({ required: true })
  phone!: string;

  @Prop({ required: true })
  address!: string;

  @Prop()
  notes?: string;

  @Prop()
  leadTimeNotes?: string; 
}

export const SupplierSchema = SchemaFactory.createForClass(Supplier);