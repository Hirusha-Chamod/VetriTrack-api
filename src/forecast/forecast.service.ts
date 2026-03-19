import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { InventoryItem } from '../inventory/schemas/inventory-item.schema';
import { StockBatch } from '../inventory/schemas/stock-batch.schema';
import { Transaction } from '../transactions/schemas/transaction.schema';

@Injectable()
export class ForecastService {
  private readonly PYTHON_API_URL = 'http://localhost:8000/forecast/batch';

  constructor(
    @InjectModel(InventoryItem.name) private itemModel: Model<InventoryItem>,
    @InjectModel(StockBatch.name) private batchModel: Model<StockBatch>,
    @InjectModel(Transaction.name) private txModel: Model<Transaction>,
    private readonly httpService: HttpService,
  ) {}

  async getRecommendations() {
    console.log('📊 Starting Smart Recommendations Gathering...');

    const items = await this.itemModel.find().lean();
    
    const batches = await this.batchModel
      .find({ quantityOnHand: { $gt: 0 } })
      .sort({ expiryDate: 1 })
      .lean();

    const twentyEightDaysAgo = new Date();
    twentyEightDaysAgo.setDate(twentyEightDaysAgo.getDate() - 28);
    twentyEightDaysAgo.setHours(0, 0, 0, 0);

    const transactions = await this.txModel
      .find({
        type: 'ISSUE',
        createdAt: { $gte: twentyEightDaysAgo },
      })
      .lean();

    console.log(`🔍 Found ${items.length} items, ${batches.length} batches, and ${transactions.length} recent issues.`);

    const txHistoryMap: Record<string, Record<string, number>> = {};

    transactions.forEach((tx) => {
      const itemId = tx.itemId.toString();
      // 👇 Fixed: Cast to any so TS knows createdAt exists from Mongoose timestamps
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
      for (let i = 27; i >= 0; i--) {
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
      console.log('🚀 Sending payload to Python ML API...');
      const response = await firstValueFrom(
        this.httpService.post(this.PYTHON_API_URL, { items: forecastPayload }),
      );
      
      console.log(`✅ Received ${response.data.length} recommendations from ML API!`);
      return response.data; 
      
    } catch (error: any) { // 👇 Fixed: typed as 'any' to fix 'unknown' TS error
      console.error('❌ Failed to reach Python API:', error.message);
      throw new InternalServerErrorException('Forecasting engine is currently unavailable.');
    }
  }
}