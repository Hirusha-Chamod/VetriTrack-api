import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { InventoryItem } from './schemas/inventory-item.schema';
import { StockBatch } from './schemas/stock-batch.schema';
import { CreateItemDto } from './dto/create-item.dto';
import { AddBatchDto } from './dto/add-batch.dto';

@Injectable()
export class InventoryService {
  constructor(
    @InjectModel(InventoryItem.name) private itemModel: Model<InventoryItem>,
    @InjectModel(StockBatch.name) private batchModel: Model<StockBatch>,
  ) {}

  async createItem(dto: CreateItemDto) {
    return await this.itemModel.create(dto);
  }

  async addBatch(dto: AddBatchDto) {
    return await this.batchModel.create(dto);
  }

async findAllItems() {
    // 1. Fetch all items as plain JavaScript objects
    const items = await this.itemModel.find().sort({ itemName: 1 }).lean().exec();

    // 2. Loop through each item and calculate its total stock
    const itemsWithStock = await Promise.all(
      items.map(async (item) => {
        // 🔥 FIXED: Search for BOTH the ObjectId and the plain string!
        const batches = await this.batchModel.find({ 
          $or: [
            { itemId: item._id },
            { itemId: item._id.toString() } 
          ]
        });
        
        // Add up the quantityOnHand from all active batches
        const currentStock = batches.reduce((sum, batch) => sum + batch.quantityOnHand, 0);
        
        return {
          ...item,
          currentStock,
        };
      })
    );

    return itemsWithStock;
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
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);

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
      } else if (daysDiff <= 30) {
        expiringSoon.push({ ...mappedData, daysUntilExpiry: daysDiff });
      }
    }

    return { expiringSoon, expired };
  }
}