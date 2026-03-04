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

  // Creates a new master product
  async createItem(dto: CreateItemDto) {
    return await this.itemModel.create(dto);
  }

  // Adds a specific stock delivery to an item
  async addBatch(dto: AddBatchDto) {
    return await this.batchModel.create(dto);
  }

  // Retrieves all items with their calculated total stock across all batches
  async findAllItems() {
    return await this.itemModel.find().exec();
  }

  // Gets all individual stock batches for a specific product
  async findBatchesByItem(itemId: string) {
    return await this.batchModel.find({ itemId }).sort({ expiryDate: 1 }).exec();
  }

  // Identifies the earliest expiring batch for FEFO issuance
  async suggestFefoBatch(itemId: string) {
    const batch = await this.batchModel.findOne({
      itemId,
      quantityOnHand: { $gt: 0 },
      expiryDate: { $gt: new Date() }, // Ensure not already expired
    })
    .sort({ expiryDate: 1 })
    .exec();

    if (!batch) throw new NotFoundException('No valid stock available');
    return batch;
  }

  // Updates reorder threshold for the Owner's settings screen
  async updateReorderLevel(itemId: string, minLevel: number) {
    const item = await this.itemModel.findByIdAndUpdate(
      itemId,
      { minStockLevel: minLevel },
      { new: true }
    );
    if (!item) throw new NotFoundException('Item not found');
    return item;
  }

  // Aggregates total stock and filters items below their minimum level
  async getLowStockAlerts() {
    return await this.batchModel.aggregate([
      { $group: { _id: '$itemId', totalStock: { $sum: '$quantityOnHand' } } },
      {
        $lookup: {
          from: 'inventoryitems',
          localField: '_id',
          foreignField: '_id',
          as: 'itemDetails'
        }
      },
      { $unwind: '$itemDetails' },
      {
        $project: {
          itemName: '$itemDetails.itemName',
          totalStock: 1,
          minLevel: '$itemDetails.minStockLevel',
          isLow: { $lte: ['$totalStock', '$itemDetails.minStockLevel'] }
        }
      },
      { $match: { isLow: true } }
    ]);
  }
}