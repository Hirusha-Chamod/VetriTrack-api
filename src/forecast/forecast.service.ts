import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { InventoryItem } from '../inventory/schemas/inventory-item.schema';
import { StockBatch } from '../inventory/schemas/stock-batch.schema';
import { Transaction } from '../transactions/schemas/transaction.schema';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class ForecastService {
  private readonly PYTHON_API_URL = 'http://localhost:8000/forecast/batch';

  constructor(
    @InjectModel(InventoryItem.name) private itemModel: Model<InventoryItem>,
    @InjectModel(StockBatch.name) private batchModel: Model<StockBatch>,
    @InjectModel(Transaction.name) private txModel: Model<Transaction>,
    private readonly httpService: HttpService,
    private readonly settingsService: SettingsService,
  ) {}

  async getRecommendations() {
    const settings = await this.settingsService.getSettings();
    const horizonDays = settings.recommendationHorizonDays || 30;
    const expiryAlertDays = settings.expiryAlertDays || 7; 

    const items = await this.itemModel.find().lean();
    
    const batches = await this.batchModel
      .find({ quantityOnHand: { $gt: 0 } })
      .sort({ expiryDate: 1 })
      .lean();

    const historicalStartDate = new Date();
    historicalStartDate.setDate(historicalStartDate.getDate() - horizonDays);
    historicalStartDate.setHours(0, 0, 0, 0);

    const transactions = await this.txModel
      .find({
        type: 'ISSUE',
        createdAt: { $gte: historicalStartDate },
      })
      .lean();

    const txHistoryMap: Record<string, Record<string, number>> = {};

    transactions.forEach((tx) => {
      const itemId = tx.itemId.toString();
      const dateKey = (tx as any).createdAt.toISOString().split('T')[0];
      
      if (!txHistoryMap[itemId]) txHistoryMap[itemId] = {};
      
      const qty = Math.abs(tx.quantity);
      txHistoryMap[itemId][dateKey] = (txHistoryMap[itemId][dateKey] || 0) + qty;
    });

    const forecastPayload = items.map((item) => {
      const itemIdStr = item._id.toString();

      const itemBatches = batches
        .filter((b) => b.itemId.toString() === itemIdStr)
        .map((b) => ({
          batchCode: b.batchCode,
          expiryDate: b.expiryDate.toISOString(),
          quantityOnHand: b.quantityOnHand,
        }));

      const demandHistory: number[] = [];
      for (let i = horizonDays - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateKey = d.toISOString().split('T')[0];
        
        demandHistory.push(txHistoryMap[itemIdStr]?.[dateKey] || 0);
      }

      return {
        itemCode: item.itemCode,
        itemName: item.itemName,
        category: item.category,
        unitOfMeasure: item.unitOfMeasure,
        minStockLevel: item.minStockLevel,
        unitPrice: item.unitPrice,
        batches: itemBatches,
        demandHistory: demandHistory,
      };
    });

    try {
      const response = await firstValueFrom(
        this.httpService.post(this.PYTHON_API_URL, { 
          horizon_days: horizonDays, 
          expiry_alert_days: expiryAlertDays,
          items: forecastPayload 
        }),
      );
      
      return response.data; 
      
    } catch (error: any) { 
      throw new InternalServerErrorException('Forecasting engine is currently unavailable.');
    }
  }
}