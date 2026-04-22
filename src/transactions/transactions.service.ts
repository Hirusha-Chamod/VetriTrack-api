import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { StockBatch } from '../inventory/schemas/stock-batch.schema';
import { Transaction } from './schemas/transaction.schema';
import { InventoryItem } from '../inventory/schemas/inventory-item.schema';
import { Supplier } from '../suppliers/schema/supplier.schema';
import * as XLSX from 'xlsx';

@Injectable()
export class TransactionsService {
  constructor(
    @InjectModel(Transaction.name) private transactionModel: Model<Transaction>,
    @InjectModel(StockBatch.name) private batchModel: Model<StockBatch>,
    @InjectModel(InventoryItem.name) private itemModel: Model<InventoryItem>,
    @InjectModel(Supplier.name) private supplierModel: Model<Supplier>,
  ) {}

  async create(createDto: CreateTransactionDto, userId: string) {
    try {
      const { itemId, batchId, quantity, type, batchLotNumber, expiryDate, supplierId, reason } = createDto;
      const objectIdItemId = new Types.ObjectId(itemId);
      
      if (type === 'ISSUE' && !batchId) {
        const batches = await this.batchModel
          .find({ itemId: objectIdItemId, quantityOnHand: { $gt: 0 } })
          .sort({ expiryDate: 1 });

        if (batches.length === 0) {
          throw new BadRequestException('No suitable batch found with available stock');
        }

        const totalAvailable = batches.reduce((sum, b) => sum + b.quantityOnHand, 0);

        if (totalAvailable < quantity) {
          throw new BadRequestException(`Insufficient stock. You requested ${quantity}, but only have ${totalAvailable} available.`);
        }

        let remainingToIssue = quantity;
        const transactionsToLog: any[] = [];

        for (const batch of batches) {
          if (remainingToIssue <= 0) break;

          const deductQty = Math.min(batch.quantityOnHand, remainingToIssue);
          batch.quantityOnHand -= deductQty;
          remainingToIssue -= deductQty;

          await batch.save();

          transactionsToLog.push({
            itemId: objectIdItemId,
            batchId: batch._id,
            type: 'ISSUE',
            quantity: deductQty,
            reason: reason || 'FEFO Auto-Issue',
            performedBy: userId,
          });
        }

        const savedTransactions = await this.transactionModel.insertMany(transactionsToLog);
        return savedTransactions;
      }

      let batch;

      if (type === 'RECEIVE') {
        if (!batchLotNumber || !expiryDate) {
          throw new BadRequestException('Batch number and expiry date are required to receive stock');
        }

        batch = await this.batchModel.findOne({ 
          itemId: objectIdItemId,
          batchCode: batchLotNumber 
        });
        
        if (!batch) {
          if (!supplierId) throw new BadRequestException('Supplier is required to create a new batch');

          batch = await this.batchModel.create({
            itemId: objectIdItemId,
            batchCode: batchLotNumber,
            expiryDate: new Date(expiryDate),
            quantityOnHand: 0,
            supplier: supplierId,
          });
        }
      } 
      else {
        if (batchId) {
          batch = await this.batchModel.findById(batchId);
          if (!batch) throw new BadRequestException('Target batch not found');
        } else {
          const batches = await this.batchModel
            .find({ itemId: objectIdItemId, quantityOnHand: { $gt: 0 } })
            .sort({ expiryDate: 1 });
            
          if (batches.length === 0) {
            throw new BadRequestException('No active batches found for this item.');
          }
          
          batch = batches[0]; 
        }
      }

      if (type === 'RECEIVE') {
        batch.quantityOnHand += quantity;
      } else if (type === 'ADJUSTMENT') {
        if (!reason) throw new BadRequestException('Reason required for adjustments');
        
        if (batch.quantityOnHand + quantity < 0) {
          throw new BadRequestException(`Adjustment failed. This specific batch only has ${batch.quantityOnHand} units available.`);
        }
        
        batch.quantityOnHand += quantity;
      }

      await batch.save();

      const savedTx = await this.transactionModel.create({
        ...createDto,
        itemId: objectIdItemId,
        batchId: batch._id,
        performedBy: userId,
      });

      return savedTx;

    } catch (error: any) {
      throw error; 
    }
  }

  async findAll() {
    return this.transactionModel.find()
      .populate('itemId')
      .sort({ createdAt: -1 })
      .exec();
  }

  async importFromBuffer(buffer: Buffer, userId: string) {
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawData = XLSX.utils.sheet_to_json(worksheet);

      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      for (let i = 0; i < rawData.length; i++) {
        const row: any = rawData[i];
        
        try {
          const itemCode = row['Item Code'];
          const type = row['Type']?.toString().toUpperCase();
          const quantity = parseInt(row['Quantity'], 10);
          const reason = row['Reason'];

          if (!itemCode || !type || isNaN(quantity)) {
            throw new Error('Missing required fields: Item Code, Type, or valid Quantity');
          }

          const item = await this.itemModel.findOne({ itemCode: String(itemCode) });
          if (!item) {
            throw new Error(`Item not found: ${itemCode}`);
          }

          const dto: any = {
            itemId: item._id.toString(),
            type,
            quantity,
            reason: reason || 'Bulk Import',
          };

          if (type === 'RECEIVE') {
            const batchCode = row['Batch Code'];
            const supplierEmail = row['Supplier Email'];
            const expiryRaw = row['Expiry Date'];

            if (!batchCode || !supplierEmail || !expiryRaw) {
              throw new Error('RECEIVE transactions require Batch Code, Supplier Email, and Expiry Date');
            }

            const supplier = await this.supplierModel.findOne({ email: supplierEmail });
            if (!supplier) {
              throw new Error(`Supplier not found: ${supplierEmail}`);
            }

            let finalExpiryDate: Date;
            if (typeof expiryRaw === 'number') {
              finalExpiryDate = new Date(Math.round((expiryRaw - 25569) * 86400 * 1000));
            } else {
              finalExpiryDate = new Date(expiryRaw);
            }

            dto.batchLotNumber = String(batchCode);
            dto.supplierId = supplier._id.toString();
            dto.expiryDate = finalExpiryDate;
          } else {
            const batchCode = row['Batch Code'];
            if (batchCode) {
              const batch = await this.batchModel.findOne({ 
                itemId: item._id, 
                batchCode: String(batchCode) 
              });
              if (batch) {
                dto.batchId = batch._id.toString();
              }
            }
          }

          await this.create(dto, userId);
          successCount++;
        } catch (error: any) {
          errorCount++;
          errors.push(`Row ${i + 2}: ${error.message}`);
        }
      }

      if (successCount === 0 && errorCount > 0) {
        throw new BadRequestException(`Import failed completely. Errors: ${errors.join(' | ')}`);
      }

      return { 
        success: true, 
        message: `Imported ${successCount} transactions. ${errorCount > 0 ? `Failed ${errorCount} rows. Errors: ${errors.join(' | ')}` : ''}`
      };

    } catch (error: any) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('Failed to process file. Ensure it is a valid Excel or CSV.');
    }
  }

async seedHistoricalTransactions() {
  console.log('🌱 Starting HIGH-DENSITY Historical Data Seeder...');
  
  const items = await this.itemModel.find().exec();
  if (items.length === 0) return { message: 'No items found.' };

  await this.transactionModel.deleteMany({ performedBy: 'AI Seeder Script' });

  const transactionsToInsert: any[] = [];
  const today = new Date();

  // Poisson generator helper
  const getPoisson = (lambda: number) => {
    let L = Math.exp(-lambda), k = 0, p = 1;
    do { k++; p *= Math.random(); } while (p > L);
    return k - 1;
  };

  for (const item of items) {
    const cat = item.category;
    
    // Assign a "Velocity" (lambda) based on category
    // This ensures demand is NOT 0 every day
    let lambda = 0.5; // Default slow
    if (['Medication', 'Antibiotics'].includes(cat)) lambda = 3.0;
    else if (cat === 'Vaccine') lambda = 2.0;
    else if (cat === 'Supplement') lambda = 1.0;
    else if (cat === 'Treatment') lambda = 0.8;

    for (let i = 180; i >= 0; i--) {
      // Poisson generates a number of sales for this day (usually > 0)
      const qty = getPoisson(lambda);
      
      if (qty > 0) {
        const txDate = new Date(today);
        txDate.setDate(today.getDate() - i);
        txDate.setHours(9 + Math.floor(Math.random() * 8)); 

        transactionsToInsert.push({
          itemId: item._id,
          type: 'ISSUE', 
          quantity: qty, 
          reason: 'Seeded historical transaction', 
          performedBy: 'AI Seeder Script', 
          createdAt: txDate,
          updatedAt: txDate,
        });
      }
    }
  }

  if (transactionsToInsert.length > 0) {
    await this.transactionModel.collection.insertMany(transactionsToInsert); 
  }

  console.log(`✅ Seeded ${transactionsToInsert.length} high-density transactions.`);
  return { message: `Seeded ${transactionsToInsert.length} transactions.` };
}

  
}