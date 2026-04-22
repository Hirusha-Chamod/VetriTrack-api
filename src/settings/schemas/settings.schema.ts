import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class SystemSettings extends Document {
  // We use a fixed ID so we only ever have one settings document
  @Prop({ required: true, default: 'global', unique: true })
  settingId!: string;

  // 👇 Strict enforcement to protect the Multi-Model Python API
  @Prop({ required: true, default: 30, enum: [30, 90, 180] })
  recommendationHorizonDays!: number;

  @Prop({ required: true, default: 7 })
  expiryAlertDays!: number;
}

export const SystemSettingsSchema = SchemaFactory.createForClass(SystemSettings);