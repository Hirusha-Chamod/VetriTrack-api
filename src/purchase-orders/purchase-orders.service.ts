import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MailerService } from '@nestjs-modules/mailer';
import { PurchaseOrder } from './schemas/purschase-order.schema';
import { Supplier } from '../suppliers/schema/supplier.schema'; // Make sure this path is correct
import { AddPoItemDto } from './dto/add-po-item.dto';
import { CreatePoDto } from './dto/create-po.dto';

@Injectable()
export class PurchaseOrdersService {
  constructor(
    @InjectModel(PurchaseOrder.name) private poModel: Model<PurchaseOrder>,
    @InjectModel(Supplier.name) private supplierModel: Model<Supplier>, // Injected Supplier
    private readonly mailerService: MailerService, // Injected Mailer
  ) {}

  async createDraft(dto: CreatePoDto) {
    const year = new Date().getFullYear();
    const count = await this.poModel.countDocuments();
    const poNumber = `PO-${year}-${(count + 1).toString().padStart(3, '0')}`;

    return await this.poModel.create({
      ...dto,
      poNumber,
      status: 'Draft',
    });
  }

  async addItemToDraft(poId: string, itemDto: AddPoItemDto) {
    const po = await this.poModel.findById(poId);
    if (!po) throw new NotFoundException('Purchase Order not found');
    if (po.status !== 'Draft') throw new BadRequestException('Cannot add items to a non-draft PO');

    po.items.push({
      itemId: new Types.ObjectId(itemDto.itemId), 
      quantityRequested: itemDto.quantity,
      quantityReceived: 0,
      unitPrice: itemDto.unitPrice,
    });

    po.totalValue += itemDto.quantity * itemDto.unitPrice;
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

  // Updates PO status & Sends Initial Email
  async updateStatus(id: string, status: string) {
    const updateData: any = { status };
    
    // Start the clock when sent!
    if (status === 'Sent') {
      updateData.sentAt = new Date();
    }

    const po = await this.poModel.findByIdAndUpdate(id, updateData, { new: true })
      .populate('supplierId') 
      .populate('items.itemId');

    if (!po) throw new NotFoundException('Purchase Order not found');

    // Send the Initial Order Email
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

  // The 24-Hour Reminder Logic
  async sendReminder(poId: string) {
    const po = await this.poModel.findById(poId).populate('supplierId').populate('items.itemId');
    if (!po) throw new NotFoundException('PO not found');
    
    if (po.status !== 'Sent' && po.status !== 'Partial') {
      throw new BadRequestException(`Cannot send a reminder for a PO that is ${po.status}`);
    }

    // Lock it out if sent within the last 24 hours
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

    // Update the timestamp in the DB
    po.lastReminderSentAt = new Date();
    return await po.save();
  }

  // Records receipt of items & Automatically Calculates Lead Time
  async receiveItems(poId: string, itemId: string, qty: number) {
    const po = await this.poModel.findById(poId);
    if (!po) throw new NotFoundException('PO not found');

    const item = po.items.find((i) => i.itemId.toString() === itemId);
    if (!item) throw new NotFoundException('Item not found in this PO');

    item.quantityReceived += qty;

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
        supplier.leadTimeNotes = `${Math.round(newAvg)} days (Auto-calculated)`; 
        
        await supplier.save();
      }
    }

    return await po.save();
  }
}