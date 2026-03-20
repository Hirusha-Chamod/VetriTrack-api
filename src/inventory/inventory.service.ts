import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { InventoryItem } from './schemas/inventory-item.schema';
import { StockBatch } from './schemas/stock-batch.schema';
import { CreateItemDto } from './dto/create-item.dto';
import { AddBatchDto } from './dto/add-batch.dto';
import { Supplier } from 'src/suppliers/schema/supplier.schema';
import * as XLSX from 'xlsx';
import { SettingsService } from 'src/settings/settings.service';

@Injectable()
export class InventoryService {
  constructor(
    @InjectModel(InventoryItem.name) private itemModel: Model<InventoryItem>,
    @InjectModel(StockBatch.name) private batchModel: Model<StockBatch>,
    @InjectModel(Supplier.name) private supplierModel: Model<Supplier>,
    private settingsService: SettingsService,
  ) {}

  async createItem(dto: CreateItemDto) {
    return await this.itemModel.create(dto);
  }

  async addBatch(dto: AddBatchDto) {
    return await this.batchModel.create(dto);
  }

async findAllItems(query: any = {}) {
    const { category, stockStatus, expiryStatus, sort } = query;
    
    // 👇 1. FETCH DYNAMIC SETTINGS FIRST
    const settings = await this.settingsService.getSettings();
    const expiryThresholdDays = settings.expiryAlertDays; 

    const match: any = {};
    if (category && category !== 'all') {
      match.category = { $regex: new RegExp(`^${category}$`, 'i') };
    } 

    const items = await this.itemModel.find(match).lean().exec();

    const now = new Date();
    // 👇 2. USE THE DYNAMIC THRESHOLD
    const expiryThresholdDate = new Date();
    expiryThresholdDate.setDate(now.getDate() + expiryThresholdDays);

    let processedItems = await Promise.all(
      items.map(async (item) => {
        const batches = await this.batchModel.find({ 
          $or: [{ itemId: item._id }, { itemId: item._id.toString() }] 
        });
        
        const currentStock = batches.reduce((sum, batch) => sum + batch.quantityOnHand, 0);
        const activeBatches = batches.filter(b => b.quantityOnHand > 0);
        
        let nearestExpiry: Date | null = null;
        let itemExpiryStatus = 'good'; 

        if (activeBatches.length > 0) {
          nearestExpiry = activeBatches.reduce(
            (min, b) => (b.expiryDate < min ? b.expiryDate : min), 
            activeBatches[0].expiryDate
          );

          if (nearestExpiry <= now) {
            itemExpiryStatus = 'expired';
          } else if (nearestExpiry <= expiryThresholdDate) { // 👈 DYNAMIC CHECK
            itemExpiryStatus = 'expiring-soon';
          }
        }

        return { ...item, currentStock, nearestExpiry, itemExpiryStatus };
      })
    );

    // Apply Post-Calculation Filters
    if (stockStatus && stockStatus !== 'all') {
      processedItems = processedItems.filter(item => {
        if (stockStatus === 'low-stock') return item.currentStock <= item.minStockLevel;
        if (stockStatus === 'in-stock') return item.currentStock > item.minStockLevel;
        return true;
      });
    }

    if (expiryStatus && expiryStatus !== 'all') {
      processedItems = processedItems.filter(item => item.itemExpiryStatus === expiryStatus);
    } 

    // Apply Sorting
    processedItems.sort((a, b) => {
      if (sort === 'stock-asc') {
        return a.currentStock - b.currentStock;
      } else if (sort === 'expiry-asc') {
        if (!a.nearestExpiry && !b.nearestExpiry) return 0;
        if (!a.nearestExpiry) return 1;
        if (!b.nearestExpiry) return -1;
        return a.nearestExpiry.getTime() - b.nearestExpiry.getTime();
      }
      return a.itemName.localeCompare(b.itemName);
    });

    return processedItems;
  }

  async findBatchesByItem(itemId: string) {
    return await this.batchModel
      .find({ itemId })
      .populate('supplier', 'supplierName') 
      .sort({ expiryDate: 1 })
      .exec();
  }

  async suggestFefoBatch(itemId: string) {
    const batch = await this.batchModel.findOne({
      itemId,
      quantityOnHand: { $gt: 0 },
      expiryDate: { $gt: new Date() },
    })
    .sort({ expiryDate: 1 })
    .exec();

    if (!batch) throw new NotFoundException('No valid stock available');
    return batch;
  }

  async updateReorderLevel(itemId: string, minLevel: number) {
    const item = await this.itemModel.findByIdAndUpdate(
      itemId,
      { minStockLevel: minLevel },
      { new: true }
    );
    if (!item) throw new NotFoundException('Item not found');
    return item;
  }

  async getLowStockAlerts() {
    return await this.batchModel.aggregate([
      {
        $group: {
          _id: '$itemId',
          totalStock: { $sum: '$quantityOnHand' },
        },
      },
      {
        $lookup: {
          from: 'inventoryitems',
          localField: '_id',
          foreignField: '_id',
          as: 'itemDetails',
        },
      },
      { $unwind: '$itemDetails' },
      {
        $project: {
          itemCode: '$itemDetails.itemCode',
          itemName: '$itemDetails.itemName',
          totalStock: 1,
          minLevel: '$itemDetails.minStockLevel',
          unitOfMeasure: '$itemDetails.unitOfMeasure',
          isLow: { $lte: ['$totalStock', '$itemDetails.minStockLevel'] },
        },
      },
      { $match: { isLow: true } },
    ]);
  }

  async getExpiryReport() {
    const today = new Date();
    
    // 👇 1. FETCH DYNAMIC SETTINGS
    const settings = await this.settingsService.getSettings();
    const expiryThresholdDays = settings.expiryAlertDays;

    const batches = await this.batchModel
      .find({ quantityOnHand: { $gt: 0 } })
      .populate('itemId')
      .populate('supplier') 
      .exec();

    const expiringSoon: any[] = [];
    const expired: any[] = [];

    for (const batch of batches) {
      const item = batch.itemId as any;
      const supplierDoc = batch.supplier as any; 
      
      if (!item) continue;

      const expiry = new Date(batch.expiryDate);
      const daysDiff = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 3600 * 24));
      const value = batch.quantityOnHand * (item.unitPrice || 0);

      const mappedData = {
        _id: batch._id.toString(),
        itemCode: item.itemCode,
        product: item.itemName,
        batchId: batch.batchCode,
        expiryDate: batch.expiryDate,
        quantity: batch.quantityOnHand,
        unit: item.unitOfMeasure,
        supplier: supplierDoc ? supplierDoc.supplierName : 'Unknown Supplier',
        value: value,
      };

      if (daysDiff <= 0) {
        expired.push({ ...mappedData, daysExpired: Math.abs(daysDiff) });
      } else if (daysDiff <= expiryThresholdDays) { // 👇 2. DYNAMIC CHECK
        expiringSoon.push({ ...mappedData, daysUntilExpiry: daysDiff });
      }
    }

    return { expiringSoon, expired };
  }

  // ─── IMPORT LOGIC (ITEMS + BATCHES + SUPPLIERS) ───────────────────────────
  async importFromBuffer(buffer: Buffer) {
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawData = XLSX.utils.sheet_to_json(worksheet);

      let itemsProcessed = 0;
      let batchesProcessed = 0;

      for (const row of rawData as any[]) {
        // 1. Extract Item Data
        const itemCode = row['Item Code'];
        if (!itemCode) continue; // Skip empty rows

        // 2. Upsert Inventory Item
        const itemData = {
          itemCode: String(itemCode),
          itemName: row['Item Name'] || 'Unknown Item',
          category: row['Category'] || 'Uncategorized',
          unitOfMeasure: row['Unit'] || 'units',
          minStockLevel: parseInt(row['Min Stock']) || 0,
          unitPrice: parseFloat(row['Unit Price']) || 0,
        };

        const item = await this.itemModel.findOneAndUpdate(
          { itemCode: itemData.itemCode },
          { $set: itemData },
          { new: true, upsert: true }
        );
        itemsProcessed++;

        // 3. Process Batch Data (If provided)
        const batchCode = row['Batch Code'];
        const supplierEmail = row['Supplier Email'];
        const expiryRaw = row['Expiry Date']; // 👈 Note: Changed to expiryRaw
        const qty = parseInt(row['Quantity']) || 0;

        if (batchCode && supplierEmail && expiryRaw) {
          // Look up supplier by exact email match
          const supplier = await this.supplierModel.findOne({ email: supplierEmail });
          
          if (supplier) {
            
            // 👇 THE DATE FIX: Handle both Excel Serial Numbers AND normal Strings
            let finalExpiryDate: Date;
            if (typeof expiryRaw === 'number') {
              // Convert Excel serial date to an actual Javascript Date
              finalExpiryDate = new Date(Math.round((expiryRaw - 25569) * 86400 * 1000));
            } else {
              // It's a normal string (like "2026-10-15")
              finalExpiryDate = new Date(expiryRaw);
            }

            // Upsert the Batch
            await this.batchModel.findOneAndUpdate(
              { itemId: item._id, batchCode: String(batchCode) },
              {
                $set: {
                  expiryDate: finalExpiryDate,
                  quantityOnHand: qty,
                  supplier: supplier._id,
                }
              },
              { upsert: true }
            );
            batchesProcessed++;
          } else {
            console.warn(`Skipped batch ${batchCode}: Supplier email ${supplierEmail} not found.`);
          }
        }
      }

      return { 
        success: true, 
        message: `Imported/Updated ${itemsProcessed} items and ${batchesProcessed} stock batches.` 
      };

    } catch (error) {
      console.error(error);
      throw new BadRequestException('Failed to process inventory file. Check date formats and required columns.');
    }
  }

  // ─── EXPORT LOGIC ─────────────────────────────────────────────────────────
  async exportToExcel(): Promise<Buffer> {
    // Get all batches with their Item and Supplier populated
    const batches = await this.batchModel
      .find()
      .populate('itemId')
      .populate('supplier')
      .lean();

    // Find items that have NO batches yet (so they still show up in the export)
    const itemsWithBatches = batches.map(b => (b.itemId as any)?._id?.toString());
    const orphanedItems = await this.itemModel.find({ _id: { $nin: itemsWithBatches } }).lean();

    const exportData: any[] = [];

    // 1. Push all Batch rows
    batches.forEach(b => {
      const item = b.itemId as any;
      const sup = b.supplier as any;
      if (!item) return;

      exportData.push({
        'Item Code': item.itemCode,
        'Item Name': item.itemName,
        'Category': item.category,
        'Unit': item.unitOfMeasure,
        'Min Stock': item.minStockLevel,
        'Unit Price': item.unitPrice,
        'Batch Code': b.batchCode,
        'Quantity': b.quantityOnHand,
        'Expiry Date': new Date(b.expiryDate).toISOString().split('T')[0],
        'Supplier Email': sup?.email || 'N/A',
      });
    });

    // 2. Push Orphaned Items (Items with no stock/batches)
    orphanedItems.forEach(item => {
      exportData.push({
        'Item Code': item.itemCode,
        'Item Name': item.itemName,
        'Category': item.category,
        'Unit': item.unitOfMeasure,
        'Min Stock': item.minStockLevel,
        'Unit Price': item.unitPrice,
        'Batch Code': '',
        'Quantity': 0,
        'Expiry Date': '',
        'Supplier Email': '',
      });
    });

    // Sort alphabetically by Item Name
    exportData.sort((a, b) => a['Item Name'].localeCompare(b['Item Name']));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventory');
    
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }
}