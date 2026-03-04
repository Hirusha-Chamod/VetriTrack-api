import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Transaction } from './schemas/transaction.schema';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { StockBatch } from '../inventory/schemas/stock-batch.schema';

@Injectable()
export class TransactionsService {
  constructor(
    @InjectModel(Transaction.name) private transactionModel: Model<Transaction>,
    @InjectModel(StockBatch.name) private batchModel: Model<StockBatch>, // Injected from InventoryModule
  ) {}

  async create(createDto: CreateTransactionDto, userId: string) {
    const { batchId, quantity, type } = createDto;

    const batch = await this.batchModel.findById(batchId);
    if (!batch) throw new BadRequestException('Batch not found');

    if (type === 'ISSUE') {
      if (batch.quantityOnHand < quantity) {
        throw new BadRequestException('Insufficient stock in this batch');
      }
      batch.quantityOnHand -= quantity;
    } else if (type === 'RECEIVE') {
      batch.quantityOnHand += quantity;
    }

    await batch.save();


    return await this.transactionModel.create({
      ...createDto,
      performedBy: userId,
    });
  }

  async findAll() {
    return this.transactionModel.find()
      .populate('itemId')
      .populate('performedBy', 'fullName')
      .sort({ createdAt: -1 })
      .exec();
  }
}