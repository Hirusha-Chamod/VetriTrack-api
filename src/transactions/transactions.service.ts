import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { StockBatch } from '../inventory/schemas/stock-batch.schema';
import { Transaction } from './schemas/transaction.schema';

@Injectable()
export class TransactionsService {
  constructor(
    @InjectModel(Transaction.name) private transactionModel: Model<Transaction>,
    @InjectModel(StockBatch.name) private batchModel: Model<StockBatch>,
  ) {}

 async create(createDto: CreateTransactionDto, userId: string) {
    try {
      // 1. Add supplierId to the destructured list
      const { itemId, batchId, quantity, type, batchLotNumber, expiryDate, supplierId } = createDto;
      let batch;

      if (type === 'RECEIVE') {
        if (!batchLotNumber || !expiryDate) {
          throw new BadRequestException('Batch number and expiry date are required to receive stock');
        }

        batch = await this.batchModel.findOne({ itemId, batchCode: batchLotNumber });
        
        if (!batch) {
          // 2. Ensure we have it
          if (!supplierId) throw new BadRequestException('Supplier is required to create a new batch');

          batch = await this.batchModel.create({
            itemId,
            batchCode: batchLotNumber,
            expiryDate: new Date(expiryDate),
            quantityOnHand: 0,
            supplier: supplierId, // 3. ADD THIS LINE TO SATISFY MONGOOSE!
          });
        }
      } 
      else if (!batchId) {
        batch = await this.batchModel.findOne({ itemId, quantityOnHand: { $gt: 0 } }).sort({ expiryDate: 1 });
        if (!batch) throw new BadRequestException('No suitable batch found with available stock');
      } 
      else {
        batch = await this.batchModel.findById(batchId);
        if (!batch) throw new BadRequestException('Target batch not found');
      }

      // --- 2. APPLY THE QUANTITY CHANGES ---
      if (type === 'ISSUE') {
        if (batch.quantityOnHand < quantity) throw new BadRequestException('Insufficient stock in batch');
        batch.quantityOnHand -= quantity;
      } 
      else if (type === 'RECEIVE') {
        batch.quantityOnHand += quantity;
      } 
      else if (type === 'ADJUSTMENT') {
        if (!createDto.reason) throw new BadRequestException('Reason required for adjustments');
        batch.quantityOnHand += quantity; 
      }

      await batch.save();

      // --- 3. LOG THE TRANSACTION ---
      return await this.transactionModel.create({
        ...createDto,
        batchId: batch._id,
        performedBy: userId,
      });

    } catch (error: any) {
      // 👇 THIS WILL PRINT THE EXACT ERROR IN YOUR TERMINAL 👇
      console.error("🔥 TRANSACTION FAILED 🔥:", error.message || error);
      throw error; 
    }
  }

  async findAll() {
    return this.transactionModel.find()
      .populate('itemId')
      .sort({ createdAt: -1 })
      .exec();
  }
}