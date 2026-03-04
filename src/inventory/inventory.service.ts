import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { InventoryItem } from './schemas/inventory-item.schema';
import { StockBatch } from './schemas/stock-batch.schema';

@Injectable()
export class InventoryService {
  constructor(
    @InjectModel(InventoryItem.name) private itemModel: Model<InventoryItem>,
    @InjectModel(StockBatch.name) private batchModel: Model<StockBatch>,
  ) {}

  // Registers a new product in the system
  async createItem(data: any) {
    return await this.itemModel.create(data);
  }

  // Records a new stock delivery for an item
  async addBatch(data: any) {
    return await this.batchModel.create(data);
  }

  // Retrieves all products
  async findAllItems() {
    return await this.itemModel.find().exec();
  }

  // Finds the oldest non-expired batch with available stock
  async suggestFefoBatch(itemId: string) {
    const batch = await this.batchModel.findOne({
      itemId,
      quantityOnHand: { $gt: 0 },
      isExpired: false,
    })
    .sort({ expiryDate: 1 }) // Earliest expiry date first
    .exec();

    if (!batch) {
      throw new NotFoundException('No valid stock available for this item');
    }
    return batch;
  }
}