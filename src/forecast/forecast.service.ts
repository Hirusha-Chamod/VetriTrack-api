import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { InventoryItem } from '../inventory/schemas/inventory-item.schema';
import { StockBatch } from '../inventory/schemas/stock-batch.schema';
import { Transaction } from '../transactions/schemas/transaction.schema';
import { SettingsService } from '../settings/settings.service'; // 👈 1. IMPORT THIS

@Injectable()
export class ForecastService {
  private readonly PYTHON_API_URL = 'http://localhost:8000/forecast/batch';

  constructor(
    @InjectModel(InventoryItem.name) private itemModel: Model<InventoryItem>,
    @InjectModel(StockBatch.name) private batchModel: Model<StockBatch>,
    @InjectModel(Transaction.name) private txModel: Model<Transaction>,
    private readonly httpService: HttpService,
    private readonly settingsService: SettingsService, // 👈 2. INJECT THIS
  ) {}

  async getRecommendations() {
    console.log('📊 Starting Smart Recommendations Gathering...');

    // 👇 3. FETCH DYNAMIC HORIZON SETTING
    const settings = await this.settingsService.getSettings();
    const horizonDays = settings.recommendationHorizonDays || 30; // Default to 30 if something goes wrong
    
    console.log(`⏳ Using Dynamic Forecast Horizon: ${horizonDays} days`);

    const items = await this.itemModel.find().lean();
    
    const batches = await this.batchModel
      .find({ quantityOnHand: { $gt: 0 } })
      .sort({ expiryDate: 1 })
      .lean();

    // 👇 4. USE HORIZON INSTEAD OF 28
    const historicalStartDate = new Date();
    historicalStartDate.setDate(historicalStartDate.getDate() - horizonDays);
    historicalStartDate.setHours(0, 0, 0, 0);

    const transactions = await this.txModel
      .find({
        type: 'ISSUE',
        createdAt: { $gte: historicalStartDate },
      })
      .lean();

    console.log(`\n--- DEBUG FORECAST ---`);
    console.log(`Date Threshold: >= ${historicalStartDate.toISOString()}`);
    console.log(`Found ${transactions.length} ISSUE transactions in this date range.`);

    const txHistoryMap: Record<string, Record<string, number>> = {};

    transactions.forEach((tx) => {
      const itemId = tx.itemId.toString();
      const dateKey = (tx as any).createdAt.toISOString().split('T')[0];
      
      if (!txHistoryMap[itemId]) txHistoryMap[itemId] = {};
      
      const qty = Math.abs(tx.quantity);
      txHistoryMap[itemId][dateKey] = (txHistoryMap[itemId][dateKey] || 0) + qty;
    });
if (items.length > 0) {
        const firstItemId = items[0]._id.toString();
        console.log(`History Map for ${items[0].itemName}:`, txHistoryMap[firstItemId] || 'NO TRANSACTIONS FOUND');
    }
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
      // 👇 5. DYNAMIC LOOP (e.g., if horizon is 90, loops from 89 down to 0)
      for (let i = horizonDays - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateKey = d.toISOString().split('T')[0];
        
        demandHistory.push(txHistoryMap[itemIdStr]?.[dateKey] || 0);
      }
if (item.itemCode === items[0].itemCode) {
          console.log(`Final Array sent to Python for ${item.itemName}:`, demandHistory);
          console.log(`--- END DEBUG ---\n`);
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
      console.log('🚀 Sending payload to Python ML API...');
      
      // Included horizonDays in the root payload just in case your Python script wants to know!
      const response = await firstValueFrom(
        this.httpService.post(this.PYTHON_API_URL, { 
          horizon_days: horizonDays, 
          items: forecastPayload 
        }),
      );
      
      console.log(`✅ Received ${response.data.length} recommendations from ML API!`);
      return response.data; 
      
    } catch (error: any) { 
      console.error('❌ Failed to reach Python API:', error.message);
      throw new InternalServerErrorException('Forecasting engine is currently unavailable.');
    }
  }
}