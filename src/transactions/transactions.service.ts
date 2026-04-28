import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { StockBatch } from '../inventory/schemas/stock-batch.schema';
import { Transaction } from './schemas/transaction.schema';
import { InventoryItem } from '../inventory/schemas/inventory-item.schema';
import { Supplier } from '../suppliers/schema/supplier.schema';
import * as XLSX from 'xlsx';
import { User } from 'src/auth/schemas/user.schema';

/**
 * Service responsible for all inventory movements (Receiving, Issuing, Adjusting).
 * Ensures mathematical consistency across items, batches, and immutable audit logs.
 */
@Injectable()
export class TransactionsService {
  constructor(
    @InjectModel(Transaction.name) private transactionModel: Model<Transaction>,
    @InjectModel(StockBatch.name) private batchModel: Model<StockBatch>,
    @InjectModel(InventoryItem.name) private itemModel: Model<InventoryItem>,
    @InjectModel(Supplier.name) private supplierModel: Model<Supplier>,
    @InjectModel(User.name) private userModel: Model<User>,
  ) {}

  /**
   * Core Transaction Engine.
   * Routes the transaction based on its type and automatically handles batch allocations.
   */
  async create(createDto: CreateTransactionDto, userId: string) {
    console.log('\n--- STARTING TRANSACTION CREATION ---');
    console.log('Payload:', createDto);

    try {
      const { itemId, batchId, quantity, type, batchLotNumber, expiryDate, supplierId, reason } = createDto;
      const objectIdItemId = new Types.ObjectId(itemId);
      
      // ============================================================================
      // STEP 1: FEFO Auto-Allocation (First-Expiry-First-Out)
      // If issuing stock without specifying a batch, we must auto-deduct from the oldest.
      // ============================================================================
      if (type === 'ISSUE' && !batchId) {
        console.log('-> Processing ISSUE via FEFO allocation...');
        const batches = await this.batchModel
          .find({ itemId: objectIdItemId, quantityOnHand: { $gt: 0 } })
          .sort({ expiryDate: 1 }); // Sort by earliest expiry

        if (batches.length === 0) {
          throw new BadRequestException('No suitable batch found with available stock');
        }

        const totalAvailable = batches.reduce((sum, b) => sum + b.quantityOnHand, 0);
        if (totalAvailable < quantity) {
          throw new BadRequestException(`Insufficient stock. Requested ${quantity}, but only ${totalAvailable} available.`);
        }

        let remainingToIssue = quantity;
        const transactionsToLog: any[] = [];

        // Cascade the deduction across multiple batches if necessary
        for (const batch of batches) {
          if (remainingToIssue <= 0) break;

          const deductQty = Math.min(batch.quantityOnHand, remainingToIssue);
          batch.quantityOnHand -= deductQty;
          remainingToIssue -= deductQty;

          await batch.save();

          // Stage an individual audit record for each batch touched
          transactionsToLog.push({
            itemId: objectIdItemId,
            batchId: batch._id,
            type: 'ISSUE',
            quantity: deductQty,
            reason: reason || 'FEFO Auto-Issue',
            performedBy: userId,
          });
        }

        console.log('-> Inserting cascading issue transactions:', transactionsToLog);
        return await this.transactionModel.insertMany(transactionsToLog);
      }

      let batch;

      // ============================================================================
      // STEP 2: Receiving New Stock
      // Locate the existing supplier batch, or provision a new one if it's a new delivery.
      // ============================================================================
      if (type === 'RECEIVE') {
        console.log('-> Processing RECEIVE transaction...');
        
        if (!batchLotNumber || !expiryDate) {
          throw new BadRequestException('Batch number and expiry date are required to receive stock');
        }

        batch = await this.batchModel.findOne({ 
          itemId: objectIdItemId,
          batchCode: batchLotNumber 
        });
        
        if (!batch) {
          console.log('-> Creating new batch for lot:', batchLotNumber);
          if (!supplierId) {
            throw new BadRequestException('Supplier is required to create a new batch');
          }

          const newBatchData = {
            itemId: objectIdItemId,
            batchCode: batchLotNumber,
            expiryDate: new Date(expiryDate),
            quantityOnHand: 0,
            supplier: supplierId,
          };
          
          batch = await this.batchModel.create(newBatchData);
        }
      } 
      // ============================================================================
      // STEP 3: Manual Adjustments or Targeted Issues
      // Affects a specific pre-selected batch.
      // ============================================================================
      else {
        console.log('-> Processing Targeted ADJUSTMENT/ISSUE...');
        if (batchId) {
          batch = await this.batchModel.findById(batchId);
          if (!batch) throw new BadRequestException('Target batch not found');
        } else {
          // Fallback: If adjustment hits an item without specifying a batch, default to the oldest active batch
          const batches = await this.batchModel
            .find({ itemId: objectIdItemId, quantityOnHand: { $gt: 0 } })
            .sort({ expiryDate: 1 });
            
          if (batches.length === 0) {
            throw new BadRequestException('No active batches found for this item.');
          }
          batch = batches[0]; 
        }
      }

      // ============================================================================
      // STEP 4: Execute the Mathematical Ledger Update
      // ============================================================================
      if (type === 'RECEIVE') {
        batch.quantityOnHand += quantity;
      } else if (type === 'ADJUSTMENT') {
        if (!reason) throw new BadRequestException('Reason required for adjustments');
        
        if (batch.quantityOnHand + quantity < 0) {
          throw new BadRequestException(`Adjustment failed. Batch only has ${batch.quantityOnHand} units.`);
        }
        batch.quantityOnHand += quantity;
      }

      await batch.save();
      console.log(`-> Batch saved. New Quantity: ${batch.quantityOnHand}`);

      // ============================================================================
      // STEP 5: Create Immutable Audit Record
      // ============================================================================
      const txData = {
        ...createDto,
        itemId: objectIdItemId,
        batchId: batch._id,
        performedBy: userId,
      };
      
      const savedTx = await this.transactionModel.create(txData);
      console.log('--- TRANSACTION CREATION COMPLETE ---\n');
      return savedTx;

    } catch (error: any) {
      console.error('\n❌ --- TRANSACTION FAILED --- ❌');
      console.error('Error:', error.message);
      console.error('---------------------------------\n');
      
      if (error instanceof BadRequestException) throw error; 
      throw new BadRequestException(error.message || 'Transaction failed due to server error'); 
    }
  }

 async findAll() {

    // We use .lean() to return standard JavaScript objects so we can modify them easily
    const transactions = await this.transactionModel.find()
      .populate('itemId')
      .populate('batchId', 'batchCode') // 👈 Populates the batchCode
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    const userIds = [...new Set(
      transactions
        .map(t => t.performedBy)
        .filter(id => id && id.length === 24) 
    )];

    const users = await this.userModel.find(
      { _id: { $in: userIds } }, 
      'fullName username'
    ).lean().exec();

    const userMap = users.reduce((map, user) => {
      map[user._id.toString()] = user;
      return map;
    }, {} as Record<string, any>);

    return transactions.map(tx => ({
      ...tx,
      // If we found the user, attach the object. Otherwise, leave it as the raw string.
      performedBy: userMap[tx.performedBy as string] || tx.performedBy,
    }));
  }

  /**
   * Handles bulk data ingestion from Excel/CSV files.
   * Maps raw spreadsheet rows to the domain DTO and passes them through the core transaction engine.
   */
  async importFromBuffer(buffer: Buffer, userId: string) {
    try {
      // STEP 1: Parse the binary buffer into a JSON array
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawData = XLSX.utils.sheet_to_json(worksheet);

      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      // STEP 2: Iterate over rows and execute via the main `create` function
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

          // STEP 3: Resolve relational dependencies (Items, Suppliers)
          const item = await this.itemModel.findOne({ itemCode: String(itemCode) });
          if (!item) throw new Error(`Item not found: ${itemCode}`);

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
            if (!supplier) throw new Error(`Supplier not found: ${supplierEmail}`);

            // Handle Excel's proprietary date format (Serial Number vs ISO String)
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
            // Locate specific batch for adjustments/issues if provided
            const batchCode = row['Batch Code'];
            if (batchCode) {
              const batch = await this.batchModel.findOne({ 
                itemId: item._id, 
                batchCode: String(batchCode) 
              });
              if (batch) dto.batchId = batch._id.toString();
            }
          }

          // STEP 4: Execute through standard pipeline ensuring all business logic runs
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

  /**
   * Utility Seeder for testing the AI Model.
   * Generates realistic, mathematically sound (Poisson distribution) historical consumption data.
   */
  async seedHistoricalTransactions() {
    console.log('🌱 Starting Dynamic Seeder with Real Suppliers and Reasons...');
    
    // STEP 1: Fetch master data required to build contextual histories
    const items = await this.itemModel.find().exec();
    if (items.length === 0) return { message: 'No items found.' };

    const suppliers = await this.supplierModel.find().exec();
    const supplierNames = suppliers.map(s => s.supplierName);
    const supplierIds = suppliers.map(s => s._id);

    // STEP 2: Purge old dummy data to prevent massive DB bloat
    await this.transactionModel.deleteMany({ reason: { $in: ['Historical Issue', 'Inventory Replenishment'] } });

    const transactionsToInsert: any[] = [];
    const today = new Date();

    // Utility: Poisson Distribution accurately models random independent events over time (e.g., patient arrivals, item usage)
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

    // STEP 3: Generate the Timeline Data
    for (const item of items) {
      const cat = item.category;
      let baseLambda = ['Medication', 'Antibiotics'].includes(cat) ? 4.0 : 1.5; // Meds move faster
      const trendMultiplier = Math.random() > 0.5 ? 1.2 : 0.8; // Create synthetic uptrends or downtrends

      // Look back 180 days
      for (let i = 180; i >= 0; i--) {
        const txDate = new Date(today);
        txDate.setDate(today.getDate() - i);
        txDate.setHours(9 + Math.floor(Math.random() * 8)); // Randomize hour between 9am - 5pm

        let dailyLambda = baseLambda;
        // Inject a sudden trend shift in the last 30 days to test AI adaptability
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

        // Simulate a periodic bulk receive every 30 days so stock doesn't theoretically hit absolute zero
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

    // STEP 4: Bulk insert for performance efficiency
    if (transactionsToInsert.length > 0) {
      await this.transactionModel.collection.insertMany(transactionsToInsert);
    }

    console.log(`✅ Seeded ${transactionsToInsert.length} transactions.`);
    return { message: `Seeded ${transactionsToInsert.length} transactions.` };
  }
}