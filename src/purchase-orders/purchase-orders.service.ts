import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MailerService } from '@nestjs-modules/mailer';
import { PurchaseOrder } from './schemas/purschase-order.schema';
import { Supplier } from '../suppliers/schema/supplier.schema'; 
import { AddPoItemDto } from './dto/add-po-item.dto';
import { CreatePoDto } from './dto/create-po.dto';

@Injectable()
export class PurchaseOrdersService {
  constructor(
    @InjectModel(PurchaseOrder.name) private poModel: Model<PurchaseOrder>,
    @InjectModel(Supplier.name) private supplierModel: Model<Supplier>, 
    private readonly mailerService: MailerService, 
  ) {}

  async createDraft(dto: CreatePoDto) {
    const year = new Date().getFullYear();
    
    // Find the latest PO created this year to prevent E11000 duplicate key errors
    const latestPo = await this.poModel
      .findOne({ poNumber: new RegExp(`^PO-${year}`) })
      .sort({ poNumber: -1 })
      .exec();

    let nextSequence = 1;
    if (latestPo) {
      const parts = latestPo.poNumber.split('-');
      const lastSequence = parseInt(parts[2], 10);
      nextSequence = lastSequence + 1;
    }

    const poNumber = `PO-${year}-${nextSequence.toString().padStart(3, '0')}`;

    return await this.poModel.create({
      ...dto,
      poNumber,
      status: 'Draft',
      totalValue: 0,
      finalTotalValue: 0 // Root discounts are removed, defaults to 0
    });
  }

  // Smart Add: Merges quantities if item exists, otherwise adds new item
  async addItemToDraft(poId: string, itemDto: AddPoItemDto) {
    const po = await this.poModel.findById(poId);
    if (!po) throw new NotFoundException('Purchase Order not found');
    if (po.status !== 'Draft') throw new BadRequestException('Cannot add items to a non-draft PO');

    const objectId = new Types.ObjectId(itemDto.itemId);
    const existingItemIndex = po.items.findIndex(i => i.itemId.toString() === itemDto.itemId);

    if (existingItemIndex > -1) {
       // Item already exists in this draft, just increment the quantity
       po.items[existingItemIndex].quantityRequested += itemDto.quantity;
       po.items[existingItemIndex].lineTotal = po.items[existingItemIndex].quantityRequested * po.items[existingItemIndex].unitPrice;
    } else {
       // Push a completely new item
       po.items.push({
         itemId: objectId, 
         quantityRequested: itemDto.quantity,
         quantityReceived: 0,
         unitPrice: itemDto.unitPrice,
         discountType: 'None',
         discountValue: 0,
         lineTotal: itemDto.quantity * itemDto.unitPrice
       } as any);
    }

    // Recalculate root totals dynamically
    po.totalValue = po.items.reduce((sum, i) => sum + (i.quantityRequested * i.unitPrice), 0);
    po.finalTotalValue = po.items.reduce((sum, i) => sum + i.lineTotal, 0);
    
    return await po.save();
  }

  // NEW: Remove an item from a Draft PO
  async removeItemFromDraft(poId: string, itemId: string) {
    const po = await this.poModel.findById(poId);
    if (!po) throw new NotFoundException('Purchase Order not found');
    if (po.status !== 'Draft') throw new BadRequestException('Cannot remove items from a non-draft PO');

    // Filter out the item
    po.items = po.items.filter(i => i.itemId.toString() !== itemId);

    // Recalculate root totals
    po.totalValue = po.items.reduce((sum, i) => sum + (i.quantityRequested * i.unitPrice), 0);
    po.finalTotalValue = po.items.reduce((sum, i) => sum + i.lineTotal, 0);

    return await po.save();
  }

  // NEW: Delete a Draft PO entirely
  async deleteDraft(poId: string) {
    const po = await this.poModel.findById(poId);
    if (!po) throw new NotFoundException('Purchase Order not found');
    if (po.status !== 'Draft') throw new BadRequestException('Only Draft POs can be deleted');

    await this.poModel.findByIdAndDelete(poId);
    return { message: 'Draft PO successfully deleted' };
  }

  async receiveItems(
    poId: string, 
    itemId: string, 
    qty: number, 
    discountType?: 'Percentage' | 'Value' | 'None', 
    discountValue?: number
  ) {
    const po = await this.poModel.findById(poId);
    if (!po) throw new NotFoundException('PO not found');

    const item = po.items.find((i) => i.itemId.toString() === itemId);
    if (!item) throw new NotFoundException('Item not found in this PO');

    // Update quantity
    item.quantityReceived += qty;

    // Apply ITEM-LEVEL Discount Logic
    if (discountType && discountType !== 'None') {
      item.discountType = discountType;
      item.discountValue = discountValue || 0;

      const basePrice = item.quantityRequested * item.unitPrice;
      let discountAmount = 0;

      if (discountType === 'Percentage') {
        discountAmount = basePrice * (item.discountValue / 100);
      } else if (discountType === 'Value') {
        discountAmount = item.discountValue;
      }
      
      item.lineTotal = Math.max(0, basePrice - discountAmount);

    } else if (discountType === 'None') {
       item.discountType = 'None';
       item.discountValue = 0;
       item.lineTotal = item.quantityRequested * item.unitPrice;
    }

    // Re-calculate the ROOT PO totals
    po.totalValue = po.items.reduce((sum, i) => sum + (i.quantityRequested * i.unitPrice), 0);
    po.finalTotalValue = po.items.reduce((sum, i) => sum + i.lineTotal, 0);

    const wasAlreadyReceived = po.status === 'Received';
    const allReceived = po.items.every(i => i.quantityReceived >= i.quantityRequested);
    const anyReceived = po.items.some(i => i.quantityReceived > 0);
    
    po.status = allReceived ? 'Received' : anyReceived ? 'Partial' : 'Sent';

    // Automatic Lead Time Calculation
    if (po.status === 'Received' && !wasAlreadyReceived && po.sentAt) {
      const receivedAt = new Date();
      const diffTime = Math.abs(receivedAt.getTime() - po.sentAt.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

      const supplier = await this.supplierModel.findById(po.supplierId);
      if (supplier) {
        const currentAvg = supplier.averageLeadTimeDays || 0;
        const totalOrders = supplier.totalOrdersReceived || 0;
        
        const newTotalOrders = totalOrders + 1;
        const newAvg = ((currentAvg * totalOrders) + diffDays) / newTotalOrders;

        supplier.averageLeadTimeDays = Math.round(newAvg);
        supplier.totalOrdersReceived = newTotalOrders;
        supplier.leadTimeNotes = `${Math.round(newAvg)} days`; 
        
        await supplier.save();
      }
    }

    return await po.save();
  }

  async findDrafts() {
    return await this.poModel
      .find({ status: 'Draft' })
      .populate('supplierId', 'supplierName')
      .populate('items.itemId', 'itemName') 
      .sort({ updatedAt: -1 })
      .exec();
  }

  async findAll(status?: string) {
    const filter = status ? { status } : {};
    return await this.poModel
      .find(filter)
      .populate('supplierId', 'supplierName')
      .populate('items.itemId', 'itemName')
      .sort({ createdAt: -1 })
      .exec();
  }

  async updateStatus(id: string, status: string) {
    const updateData: any = { status };
    
    if (status === 'Sent') {
      updateData.sentAt = new Date();
    }

    const po = await this.poModel.findByIdAndUpdate(id, updateData, { new: true })
      .populate('supplierId') 
      .populate('items.itemId');

    if (!po) throw new NotFoundException('Purchase Order not found');

    if (status === 'Sent') {
      const supplier: any = po.supplierId;
      this.mailerService.sendMail({
        to: supplier.email,
        subject: `New Purchase Order: ${po.poNumber}`,
        text: `Hello ${supplier.contactName},\n\nPlease find attached the details for our new Purchase Order (${po.poNumber}).\n\nTotal Value: LKR ${po.totalValue.toLocaleString()}.\n\nPlease process this as soon as possible.\n\nThank you,\nVETRITRACK Purchasing`,
      }).catch(err => console.error('Failed to send PO email in background:', err));
    }

    return po;
  }

  async sendReminder(poId: string) {
    const po = await this.poModel.findById(poId).populate('supplierId').populate('items.itemId');
    if (!po) throw new NotFoundException('PO not found');
    
    if (po.status !== 'Sent' && po.status !== 'Partial') {
      throw new BadRequestException(`Cannot send a reminder for a PO that is ${po.status}`);
    }

    if (po.lastReminderSentAt) {
      const hoursSinceLastReminder = (new Date().getTime() - po.lastReminderSentAt.getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastReminder < 24) {
        throw new BadRequestException('A reminder email was already sent within the last 24 hours. Please wait before sending another.');
      }
    }

    const supplier: any = po.supplierId;
    await this.mailerService.sendMail({
      to: supplier.email,
      subject: `REMINDER: Pending Purchase Order ${po.poNumber}`,
      text: `Hello ${supplier.contactName},\n\nWe are following up on Purchase Order ${po.poNumber} which was sent on ${po.sentAt?.toLocaleDateString()}.\n\nPlease let us know the estimated delivery date.\n\nThank you,\nVETRITRACK Purchasing`,
    }).catch(err => {
      console.error('Failed to send reminder email:', err);
      throw new BadRequestException('Failed to send reminder email. Check server logs.');
    });

    po.lastReminderSentAt = new Date();
    return await po.save();
  }


  
  
}