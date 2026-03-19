import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { StockBatch } from '../inventory/schemas/stock-batch.schema';
import { PurchaseOrder } from 'src/purchase-orders/schemas/purschase-order.schema';
import { Supplier } from 'src/suppliers/schema/supplier.schema';


@Injectable()
export class AnalyticsService {
  constructor(
    @InjectModel(StockBatch.name) private batchModel: Model<StockBatch>,
    @InjectModel(PurchaseOrder.name) private poModel: Model<PurchaseOrder>,
    @InjectModel(Supplier.name) private supplierModel: Model<Supplier>,
  ) {}

  async getDashboardMetrics() {
    // 1. Calculate Total Inventory Value & Unique Items Count
    const inventoryStats = await this.batchModel.aggregate([
      { $match: { quantityOnHand: { $gt: 0 } } },
      // Join with InventoryItem collection to get the unitPrice
      { $lookup: { from: 'inventoryitems', localField: 'itemId', foreignField: '_id', as: 'itemDetails' } },
      { $unwind: '$itemDetails' },
      { $group: {
          _id: null,
          totalValue: { $sum: { $multiply: ['$quantityOnHand', '$itemDetails.unitPrice'] } },
          uniqueItemIds: { $addToSet: '$itemId' }
      }}
    ]);

    // 2. Calculate Expiring Value (Next 60 Days)
    const sixtyDaysFromNow = new Date();
    sixtyDaysFromNow.setDate(sixtyDaysFromNow.getDate() + 60);

    const expiringStats = await this.batchModel.aggregate([
      { $match: { 
          quantityOnHand: { $gt: 0 }, 
          expiryDate: { $lte: sixtyDaysFromNow, $gte: new Date() } 
      }},
      { $lookup: { from: 'inventoryitems', localField: 'itemId', foreignField: '_id', as: 'itemDetails' } },
      { $unwind: '$itemDetails' },
      { $group: {
          _id: null,
          expiringValue: { $sum: { $multiply: ['$quantityOnHand', '$itemDetails.unitPrice'] } }
      }}
    ]);

    // 3. Purchase Order Status Summary
    const poStats = await this.poModel.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    // Map DB statuses to the Figma UI labels
    const poSummaryMap: Record<string, number> = {
      'Draft': 0, 'Approved/Sent': 0, 'Partially Received': 0, 'Completed': 0
    };
    
    poStats.forEach(stat => {
      if (stat._id === 'Draft') poSummaryMap['Draft'] += stat.count;
      if (stat._id === 'Sent') poSummaryMap['Approved/Sent'] += stat.count;
      if (stat._id === 'Partial') poSummaryMap['Partially Received'] += stat.count;
      if (stat._id === 'Received') poSummaryMap['Completed'] += stat.count;
    });

    const formattedPoData = Object.keys(poSummaryMap).map(key => ({
      label: key,
      value: poSummaryMap[key],
      frontColor: '#8B5CF6', // The purple from Figma
    }));

    // 4. Supplier Lead Time Comparison
    // Get the top 5 fastest active suppliers
    const fastestSuppliers = await this.supplierModel
      .find({ status: 'Active', averageLeadTimeDays: { $gt: 0 } })
      .sort({ averageLeadTimeDays: 1 })
      .limit(5)
      .select('supplierName averageLeadTimeDays')
      .lean();

    const formattedSupplierData = fastestSuppliers.map(sup => ({
      label: sup.supplierName,
      value: sup.averageLeadTimeDays,
      frontColor: '#38BDF8', // The blue from Figma
    }));

    // Return the perfectly formatted payload for the frontend
    return {
      inventory: {
        totalValue: inventoryStats[0]?.totalValue || 0,
        totalItemsCount: inventoryStats[0]?.uniqueItemIds.length || 0,
        expiringValue: expiringStats[0]?.expiringValue || 0,
      },
      charts: {
        poSummary: formattedPoData,
        supplierLeadTimes: formattedSupplierData,
      }
    };
  }
}