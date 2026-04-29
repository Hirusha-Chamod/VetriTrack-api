import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { InventoryItem } from '../inventory/schemas/inventory-item.schema';
import { StockBatch } from '../inventory/schemas/stock-batch.schema';
import { Transaction } from '../transactions/schemas/transaction.schema';
import { SettingsService } from '../settings/settings.service';

/**
 * Service responsible for orchestrating data between the NestJS transactional database
 * and the Python FastAPI predictive AI engine.
 */
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

  // ============================================================================
  // BATCH RECOMMENDATIONS: Evaluates the entire inventory for reorder urgency
  // ============================================================================
  async getRecommendations() {
    /*
     * Step 1: Retrieve global threshold settings (e.g., how far back to look, expiry alert windows).
     */
    const settings = await this.settingsService.getSettings();
    const horizonDays = settings.recommendationHorizonDays || 30;
    const expiryAlertDays = settings.expiryAlertDays || 7; 

    /*
     * Step 2: Snapshot the current state of the warehouse.
     * We only care about batches that actually hold usable inventory.
     */
    const items = await this.itemModel.find().lean();
    const batches = await this.batchModel
      .find({ quantityOnHand: { $gt: 0 } })
      .sort({ expiryDate: 1 })
      .lean();

    /*
     * Step 3: Extract consumption history.
     * We only look at 'ISSUE' transactions to determine actual outward demand.
     */
    const historicalStartDate = new Date();
    historicalStartDate.setDate(historicalStartDate.getDate() - horizonDays);
    historicalStartDate.setHours(0, 0, 0, 0);

    const transactions = await this.txModel
      .find({
        type: 'ISSUE',
        createdAt: { $gte: historicalStartDate },
      })
      .lean();

    /*
     * Step 4: Map raw transactional logs to an aggregated daily timeline per item.
     * Example Output: { "itemId_123": { "2026-04-20": 5, "2026-04-21": 2 } }
     */
    const txHistoryMap: Record<string, Record<string, number>> = {};

    transactions.forEach((tx) => {
      const itemId = tx.itemId.toString();
      const dateKey = (tx as any).createdAt.toISOString().split('T')[0];
      
      if (!txHistoryMap[itemId]) txHistoryMap[itemId] = {};
      
      const qty = Math.abs(tx.quantity);
      txHistoryMap[itemId][dateKey] = (txHistoryMap[itemId][dateKey] || 0) + qty;
    });

    /*
     * Step 5: Normalize the data for the AI engine.
     * Mathematical models require continuous arrays. If no sales happened on a day, 
     * we MUST inject a '0' rather than skipping the day entirely.
     */
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
      // Loop backward from [horizonDays] ago up to today, filling the array sequentially
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

    /*
     * Step 6: Delegate heavy mathematical computation to the Python Microservice.
     */
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


 // ============================================================================
  // SINGLE CHART DATA: Granular timeline generation for the visual dashboard
  // ============================================================================
 
  async getChartData(itemIdStr: string, requestedHorizon?: number) {
    // STEP 1: Validate the target item
    const item = await this.itemModel.findById(itemIdStr).lean();
    if (!item) {
      throw new NotFoundException('Inventory Item not found');
    }

    
    const settings = await this.settingsService.getSettings();
    const horizonDays = requestedHorizon || settings.recommendationHorizonDays || 30;

    // STEP 2: Fetch consumption history specifically scoped to this item
    const historicalStartDate = new Date();
    historicalStartDate.setDate(historicalStartDate.getDate() - horizonDays);
    historicalStartDate.setHours(0, 0, 0, 0);

    const transactions = await this.txModel
      .find({
        itemId: new Types.ObjectId(itemIdStr), 
        type: 'ISSUE',
        createdAt: { $gte: historicalStartDate },
      })
      .lean();

    // STEP 3: Aggregate scattered transactions into daily totals
    const txHistoryMap: Record<string, number> = {};
    transactions.forEach((tx) => {
      const dateKey = (tx as any).createdAt.toISOString().split('T')[0];
      const qty = Math.abs(tx.quantity);
      txHistoryMap[dateKey] = (txHistoryMap[dateKey] || 0) + qty;
    });

    // STEP 4: Build the continuous time-series array (injecting zeros for inactive days)
    const demandHistory: number[] = [];
    for (let i = horizonDays - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateKey = d.toISOString().split('T')[0];
      
      demandHistory.push(txHistoryMap[dateKey] || 0);
    }

    // STEP 5: Construct the targeted payload. 
    const payload = {
      itemCode: item.itemCode,
      itemName: item.itemName || 'Unknown',
      category: item.category || 'Unknown',
      unitOfMeasure: item.unitOfMeasure || 'units',
      minStockLevel: item.minStockLevel || 0,
      unitPrice: item.unitPrice || 0,
      batches: [], 
      demandHistory: demandHistory,
      forecastDate: new Date().toISOString().split('T')[0]
    };

    // STEP 6: Execute request and pass the dynamically calculated horizon
    try {
      const response = await firstValueFrom(
        this.httpService.post(this.PYTHON_API_CHART_URL, payload, {
          params: { horizon_days: horizonDays } // 👈 Passes the correct dynamic horizon to Python
        })
      );
      
      return response.data; 
      
    } catch (error: any) { 
      console.error("FastAPI Error:", error.response?.data || error.message);
      throw new InternalServerErrorException('Forecasting chart engine is currently unavailable.');
    }
  }
}