import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { UpdateSettingsDto } from './dto/update-settings.dto';
import { SystemSettings } from './schemas/settings.schema';

@Injectable()
export class SettingsService {
  constructor(
    @InjectModel(SystemSettings.name) private settingsModel: Model<SystemSettings>,
  ) {}

  async getSettings(): Promise<SystemSettings> {
    let settings = await this.settingsModel.findOne({ settingId: 'global' });
    
    if (!settings) {
      settings = await this.settingsModel.create({
        settingId: 'global',
        recommendationHorizonDays: 30,
        expiryAlertDays: 7,
      });
    }
    return settings;
  }

  async updateSettings(updateDto: UpdateSettingsDto): Promise<SystemSettings> {
    const settings = await this.settingsModel.findOneAndUpdate(
      { settingId: 'global' },
      { $set: updateDto },
      { new: true, upsert: true } 
    );
    
    return settings;
  }
}