import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
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
      const { itemId, batchId, quantity, type, batchLotNumber, expiryDate, supplierId, reason } = createDto;

      // 👇 Force the string into a true MongoDB ObjectId right away
      const objectIdItemId = new Types.ObjectId(itemId);
      
      console.log('\n--- 🔍 TRANSACTION DEBUG START ---');
      console.log(`Type: ${type} | Requested Qty: ${quantity}`);
      console.log(`Raw itemId string: ${itemId}`);
      console.log(`Converted ObjectId: ${objectIdItemId}`);

      // ─── 1. TRUE FEFO ISSUE LOGIC (Multi-Batch Support) ─────────────────────
      if (type === 'ISSUE' && !batchId) {
        
        // DEBUG STEP 1: Find ALL batches for this item regardless of stock
        const debugAllBatches = await this.batchModel.find({ itemId: objectIdItemId });
        console.log(`\n[DEBUG] Total batches found for this item (ignoring stock level): ${debugAllBatches.length}`);
        debugAllBatches.forEach(b => {
            console.log(` -> Batch [${b.batchCode}]: ${b.quantityOnHand} on hand`);
        });

        // Find ALL active batches using the true ObjectId
        const batches = await this.batchModel
          .find({ itemId: objectIdItemId, quantityOnHand: { $gt: 0 } })
          .sort({ expiryDate: 1 }); // Sort oldest expiry first!

        console.log(`\n[DEBUG] Batches found with > 0 stock: ${batches.length}`);

        if (batches.length === 0) {
          throw new BadRequestException('No suitable batch found with available stock');
        }

        // Check if we have enough total stock across all batches
        const totalAvailable = batches.reduce((sum, b) => sum + b.quantityOnHand, 0);
        console.log(`[DEBUG] Total available across all valid batches: ${totalAvailable}`);

        if (totalAvailable < quantity) {
          throw new BadRequestException(`Insufficient stock. You requested ${quantity}, but only have ${totalAvailable} available.`);
        }

        let remainingToIssue = quantity;
        const transactionsToLog: any[] = [];

        // Loop through batches and drain them in order
        for (const batch of batches) {
          if (remainingToIssue <= 0) break; // Stop when we've fulfilled the request

          const deductQty = Math.min(batch.quantityOnHand, remainingToIssue);
          console.log(`[DEBUG] Deducting ${deductQty} from batch ${batch.batchCode}`);
          
          batch.quantityOnHand -= deductQty;
          remainingToIssue -= deductQty;

          await batch.save();

          // Log an audit trail for EACH batch we touched
          transactionsToLog.push({
            itemId: objectIdItemId, // 👈 Save as ObjectId
            batchId: batch._id,
            type: 'ISSUE',
            quantity: deductQty,
            reason: reason || 'FEFO Auto-Issue',
            performedBy: userId,
          });
        }

        // Save all the transaction logs and return
        const savedTransactions = await this.transactionModel.insertMany(transactionsToLog);
        console.log('--- 🔍 TRANSACTION DEBUG END ---\n');
        return savedTransactions;
      }

      // ─── 2. RECEIVE & MANUAL ADJUSTMENT LOGIC ───────────────────────────────
      let batch;

      if (type === 'RECEIVE') {
        if (!batchLotNumber || !expiryDate) {
          throw new BadRequestException('Batch number and expiry date are required to receive stock');
        }

        batch = await this.batchModel.findOne({ 
          itemId: objectIdItemId, // 👈 Query with ObjectId
          batchCode: batchLotNumber 
        });
        
        if (!batch) {
          if (!supplierId) throw new BadRequestException('Supplier is required to create a new batch');

          batch = await this.batchModel.create({
            itemId: objectIdItemId, // 👈 Save as ObjectId
            batchCode: batchLotNumber,
            expiryDate: new Date(expiryDate),
            quantityOnHand: 0,
            supplier: supplierId,
          });
        }
      } 
      else {
        // This is a manual ADJUSTMENT
        if (batchId) {
          // If the frontend passed a specific batch (e.g. from an item detail page), use it
          batch = await this.batchModel.findById(batchId);
          if (!batch) throw new BadRequestException('Target batch not found');
        } else {
          // AUTO-PILOT: The frontend didn't pass a batch, so we find one automatically.
          // We look for the oldest expiring batch that actually has stock.
          const batches = await this.batchModel
            .find({ itemId: objectIdItemId, quantityOnHand: { $gt: 0 } })
            .sort({ expiryDate: 1 });
            
          if (batches.length === 0) {
            throw new BadRequestException(
              'No active batches found for this item. If you are trying to add brand new stock, please use "Receive Stock" instead.'
            );
          }
          
          // Grab the first available batch
          batch = batches[0]; 
        }
      }

      // Apply the math
      if (type === 'RECEIVE') {
        batch.quantityOnHand += quantity;
      }else if (type === 'ADJUSTMENT') {
        if (!reason) throw new BadRequestException('Reason required for adjustments');
        
        if (batch.quantityOnHand + quantity < 0) {
          throw new BadRequestException(
            `Adjustment failed. This specific batch only has ${batch.quantityOnHand} units available.`
          );
        }
        
        batch.quantityOnHand += quantity; // UI can send negative quantity for deductions
      }

      await batch.save();

      // Log single transaction
      const savedTx = await this.transactionModel.create({
        ...createDto,
        itemId: objectIdItemId, // 👈 Overwrite the string itemId from createDto with the true ObjectId!
        batchId: batch._id,
        performedBy: userId,
      });

      console.log('--- 🔍 TRANSACTION DEBUG END ---\n');
      return savedTx;

    } catch (error: any) {
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

  // ─── SEEDER FOR AI FORECASTING ────────────────────────────────────────────
  async seedHistoricalData() {
    console.log('Seeding historical transactions for AI...');
    
    // Grab all current batches so we have valid Item IDs and Batch IDs
    const activeBatches = await this.batchModel.find().exec();
    if (activeBatches.length === 0) {
      throw new BadRequestException('No inventory found. Please import inventory first!');
    }

    const transactionsToInsert: any[] = [];

    // Loop through every batch in your database
    for (const batch of activeBatches) {
      // Go back 90 days in time
      for (let i = 0; i < 90; i++) {
        
        // 40% chance of making a sale on any given day for this item
        if (Math.random() < 0.40) {
          const pastDate = new Date();
          pastDate.setDate(pastDate.getDate() - i); // Subtract 'i' days from today

          // Randomize quantity sold (1 to 4 units)
          const qty = Math.floor(Math.random() * 4) + 1;

          transactionsToInsert.push({
            itemId: batch.itemId,
            batchId: batch._id,
            type: 'ISSUE',
            quantity: qty,
            reason: 'Simulated Historical FEFO Sale',
            performedBy: 'AI Seeder Script',
            createdAt: pastDate, // Forcing the past date!
            updatedAt: pastDate,
          });
        }
      }
    }

    // Use native MongoDB insert to bypass Mongoose's automatic timestamp overwrite
    if (transactionsToInsert.length > 0) {
      await this.transactionModel.collection.insertMany(transactionsToInsert);
    }

    return { 
      success: true, 
      message: `Successfully injected ${transactionsToInsert.length} historical 'ISSUE' transactions across 90 days. Your AI is ready!` 
    };
  }
}