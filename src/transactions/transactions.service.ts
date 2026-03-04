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
    const { itemId, batchId, quantity, type } = createDto;

    // 1. Handle FEFO Logic for 'ISSUE' if no specific batch is provided
    let targetBatchId = batchId;
    if (type === 'ISSUE' && !targetBatchId) {
      const bestBatch = await this.batchModel.findOne({ /* ... */ }).sort({ expiryDate: 1 });

      if (!bestBatch) throw new BadRequestException('No suitable batch found');
      
      targetBatchId = bestBatch._id.toString(); 
    }

    // 2. Load the batch and update stock levels
    const batch = await this.batchModel.findById(targetBatchId);
    if (!batch) throw new BadRequestException('Target batch not found');

    if (type === 'ISSUE') {
      if (batch.quantityOnHand < quantity) throw new BadRequestException('Insufficient stock');
      batch.quantityOnHand -= quantity;
    } 
    else if (type === 'RECEIVE') {
      batch.quantityOnHand += quantity;
    } 
    else if (type === 'ADJUSTMENT') {
      // Reason is required for adjustments in your UI
      if (!createDto.reason) throw new BadRequestException('Reason required for adjustments');
      // For adjustments, quantity can be positive or negative from the FE
      batch.quantityOnHand += quantity; 
    }

    await batch.save();

    // 3. Log the audit record
    return await this.transactionModel.create({
      ...createDto,
      batchId: targetBatchId,
      performedBy: userId,
    });
  }

  async findAll() {
    return this.transactionModel.find()
      .populate('itemId')
      .sort({ createdAt: -1 })
      .exec();
  }
}