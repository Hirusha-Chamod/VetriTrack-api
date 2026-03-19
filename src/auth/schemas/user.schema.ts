import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class User extends Document {
  @Prop({ required: true })
  fullName!: string;

  @Prop({ unique: true, required: true })
  username!: string;

  @Prop({ unique: true, required: true })
  email!: string; 

  @Prop({ required: true, select: false }) // select: false hides password from standard queries
  password!: string;

  @Prop({ required: true, enum: ['staff', 'owner'], default: 'staff' })
  role!: string;

  @Prop({ required: true, enum: ['active', 'inactive'], default: 'active' })
  status!: string;

  @Prop()
  lastLogin?: Date;

  @Prop()
  resetPasswordOtp?: string;

  @Prop()
  resetPasswordExpires?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);