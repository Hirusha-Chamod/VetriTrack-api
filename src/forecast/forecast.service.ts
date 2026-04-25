import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { InventoryItem } from '../inventory/schemas/inventory-item.schema';
import { StockBatch } from '../inventory/schemas/stock-batch.schema';
import { Transaction } from '../transactions/schemas/transaction.schema';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class ForecastService {
  private readonly PYTHON_API_BATCH_URL = 'http://localhost:8000/forecast/batch';
  private readonly PYTHON_API_CHART_URL = 'http://localhost:8000/forecast/chart';

  constructor(
    @InjectModel(InventoryItem.name) private itemModel: Model<InventoryItem>,
    @InjectModel(StockBatch.name) private batchModel: Model<StockBatch>,
    @InjectModel(Transaction.name) private txModel: Model<Transaction>,
    private readonly httpService: HttpService,
    private readonly settingsService: SettingsService,
  ) {}

  // ==========================================
  // EXISTING METHOD: Batch Recommendations
  // ==========================================
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
        this.httpService.post(this.PYTHON_API_BATCH_URL, { 
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


  async getChartData(itemIdStr: string) {
    const horizonDays = 30; // 30 days of history mapping for the chart

    // 1. Validate the Item
    const item = await this.itemModel.findById(itemIdStr).lean();
    if (!item) {
      throw new NotFoundException('Inventory Item not found');
    }

    // 2. Fetch specific transaction history for this item
    const historicalStartDate = new Date();
    historicalStartDate.setDate(historicalStartDate.getDate() - horizonDays);
    historicalStartDate.setHours(0, 0, 0, 0);

    const transactions = await this.txModel
      .find({
        itemId: new Types.ObjectId(itemIdStr), // Only get this item's tx
        type: 'ISSUE',
        createdAt: { $gte: historicalStartDate },
      })
      .lean();

    // 3. Map transactions to a daily timeline
    const txHistoryMap: Record<string, number> = {};
    transactions.forEach((tx) => {
      const dateKey = (tx as any).createdAt.toISOString().split('T')[0];
      const qty = Math.abs(tx.quantity);
      txHistoryMap[dateKey] = (txHistoryMap[dateKey] || 0) + qty;
    });

    // 4. Build the continuous daily array (including days with 0 sales)
    const demandHistory: number[] = [];
    for (let i = horizonDays - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateKey = d.toISOString().split('T')[0];
      
      demandHistory.push(txHistoryMap[dateKey] || 0);
    }

   const payload = {
      itemCode: item.itemCode,
      itemName: item.itemName || 'Unknown',
      category: item.category || 'Unknown',
      unitOfMeasure: item.unitOfMeasure || 'units',
      minStockLevel: item.minStockLevel || 0,
      unitPrice: item.unitPrice || 0,
      batches: [], // Provide an empty array so FastAPI doesn't crash
      demandHistory: demandHistory,
      forecastDate: new Date().toISOString().split('T')[0]
    };

    // 6. Fetch from FastAPI
    try {
      const response = await firstValueFrom(
        this.httpService.post(this.PYTHON_API_CHART_URL, payload)
      );
      
      return response.data; 
      
    } catch (error: any) { 
      // This will print the exact reason FastAPI rejected it to your NestJS terminal!
      console.error("FastAPI Error:", error.response?.data || error.message);
      
      throw new InternalServerErrorException('Forecasting chart engine is currently unavailable.');
    }
  }
}