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
    console.log('--- STARTING TRANSACTION CREATION ---');
    console.log('1. Incoming Payload:', createDto);
    console.log('2. User ID:', userId);

    try {
      const { itemId, batchId, quantity, type, batchLotNumber, expiryDate, supplierId, reason } = createDto;
      
      console.log('3. Converting Item ID to ObjectId:', itemId);
      const objectIdItemId = new Types.ObjectId(itemId);
      
      if (type === 'ISSUE' && !batchId) {
        console.log('4a. Processing ISSUE without specific batch...');
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

        console.log('4b. Inserting multiple issue transactions:', transactionsToLog);
        const savedTransactions = await this.transactionModel.insertMany(transactionsToLog);
        return savedTransactions;
      }

      let batch;

      if (type === 'RECEIVE') {
        console.log('4c. Processing RECEIVE transaction...');
        
        if (!batchLotNumber || !expiryDate) {
          console.error('ERROR: Missing batchLotNumber or expiryDate');
          throw new BadRequestException('Batch number and expiry date are required to receive stock');
        }

        console.log(`5. Looking for existing batch with code: ${batchLotNumber}`);
        batch = await this.batchModel.findOne({ 
          itemId: objectIdItemId,
          batchCode: batchLotNumber 
        });
        
        if (!batch) {
          console.log('6a. Batch not found. Creating a new one...');
          if (!supplierId) {
            console.error('ERROR: Missing supplierId for new batch');
            throw new BadRequestException('Supplier is required to create a new batch');
          }

          const newBatchData = {
            itemId: objectIdItemId,
            batchCode: batchLotNumber,
            expiryDate: new Date(expiryDate),
            quantityOnHand: 0,
            supplier: supplierId, // 👈 Make sure your StockBatch schema expects 'supplier' (not 'supplierId')
          };
          console.log('6b. New Batch Data:', newBatchData);
          
          batch = await this.batchModel.create(newBatchData);
          console.log('6c. Successfully created new batch:', batch._id);
        } else {
          console.log('6a. Found existing batch:', batch._id);
        }
      } 
      else {
        console.log('4d. Processing ADJUSTMENT or manual ISSUE...');
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

      console.log(`7. Updating batch quantity. Current: ${batch.quantityOnHand}, Modifier: ${quantity}`);
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
      console.log('8. Batch saved successfully. Quantity is now:', batch.quantityOnHand);

      const txData = {
        ...createDto,
        itemId: objectIdItemId,
        batchId: batch._id,
        performedBy: userId,
      };
      
      console.log('9. Creating final transaction record:', txData);
      const savedTx = await this.transactionModel.create(txData);
      
      console.log('--- TRANSACTION CREATION COMPLETE ---');
      return savedTx;

    } catch (error: any) {
      // 👇 THIS IS THE MOST IMPORTANT LOG. It will reveal the Mongoose Validation Error.
      console.error('\n❌ --- TRANSACTION FAILED --- ❌');
      console.error('Error Message:', error.message);
      console.error('Error Stack/Details:', error);
      console.error('---------------------------------\n');
      
      if (error instanceof BadRequestException) {
        throw error; 
      }
      
      // Throw a specific error so the frontend sees it instead of a generic 500
      throw new BadRequestException(error.message || 'Transaction failed due to server error'); 
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
    console.log('🌱 Starting Dynamic Seeder with Real Suppliers and Reasons...');
    
    const items = await this.itemModel.find().exec();
    if (items.length === 0) return { message: 'No items found.' };

    const suppliers = await this.supplierModel.find().exec();
    const supplierNames = suppliers.map(s => s.supplierName);
    const supplierIds = suppliers.map(s => s._id);

    await this.transactionModel.deleteMany({ reason: { $in: ['Historical Issue', 'Inventory Replenishment'] } });

    const transactionsToInsert: any[] = [];
    const today = new Date();

    const getPoisson = (lambda: number) => {
      let L = Math.exp(-lambda), k = 0, p = 1;
      do { k++; p *= Math.random(); } while (p > L);
      return k - 1;
    };

    const issueReasons = [
      "Routine clinical usage", 
      "Emergency medical procedure", 
      "Batch dispensing for inpatient", 
      "Pharmacy retail sale"
    ];

    for (const item of items) {
      const cat = item.category;
      let baseLambda = ['Medication', 'Antibiotics'].includes(cat) ? 4.0 : 1.5;
      const trendMultiplier = Math.random() > 0.5 ? 1.2 : 0.8;

      for (let i = 180; i >= 0; i--) {
        const txDate = new Date(today);
        txDate.setDate(today.getDate() - i);
        txDate.setHours(9 + Math.floor(Math.random() * 8));

        let dailyLambda = baseLambda;
        if (i <= 30) {
          const progress = (30 - i) / 30;
          dailyLambda = baseLambda * (1 + (trendMultiplier - 1) * progress);
        }

        const qty = getPoisson(dailyLambda);
        if (qty > 0) {
          transactionsToInsert.push({
            itemId: item._id,
            type: 'ISSUE',
            quantity: qty,
            reason: issueReasons[Math.floor(Math.random() * issueReasons.length)],
            performedBy: 'Automated System', 
            createdAt: txDate,
            updatedAt: txDate,
          });
        }

        if (i > 0 && i % 30 === 0) {
          const sIndex = Math.floor(Math.random() * suppliers.length);
          transactionsToInsert.push({
            itemId: item._id,
            type: 'RECEIVE',
            quantity: Math.ceil(baseLambda * 40),
            supplierId: supplierIds[sIndex],
            reason: `Regular stock replenishment from ${supplierNames[sIndex]}`,
            performedBy: supplierNames[sIndex], 
            createdAt: txDate,
            updatedAt: txDate,
          });
        }
      }
    }

    if (transactionsToInsert.length > 0) {
      await this.transactionModel.collection.insertMany(transactionsToInsert);
    }

    console.log(`✅ Seeded ${transactionsToInsert.length} transactions.`);
    return { message: `Seeded ${transactionsToInsert.length} transactions.` };
  }
}