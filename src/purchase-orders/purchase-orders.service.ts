import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PurchaseOrder } from './schemas/purschase-order.schema';
import { AddPoItemDto } from './dto/add-po-item.dto';
import { CreatePoDto } from './dto/create-po.dto';


@Injectable()
export class PurchaseOrdersService {
  constructor(
    @InjectModel(PurchaseOrder.name) private poModel: Model<PurchaseOrder>,
  ) {}

  // Step 1: Create a Draft PO for a selected Supplier
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

  // Step 2 & 3: Add Items/Quantity to a specific Draft PO
  async addItemToDraft(poId: string, itemDto: AddPoItemDto) {
    const po = await this.poModel.findById(poId);
    if (!po) throw new NotFoundException('Purchase Order not found');
    if (po.status !== 'Draft') throw new BadRequestException('Cannot add items to a non-draft PO');

    // Add item to array and update total value
    po.items.push({
      itemId: new Object(itemDto.itemId) as any,
      quantityRequested: itemDto.quantity,
      quantityReceived: 0,
      unitPrice: itemDto.unitPrice,
    });

    po.totalValue += itemDto.quantity * itemDto.unitPrice;
    return await po.save();
  }

  // Retrieves Draft POs grouped by Supplier for the "Draft POs" screen
  async findDrafts() {
    return await this.poModel
      .find({ status: 'Draft' })
      .populate('supplierId', 'supplierName')
      .populate('items.itemId', 'itemName')
      .sort({ updatedAt: -1 })
      .exec();
  }

  // Retrieves all POs for the main "Purchase Orders" list with status filters
  async findAll(status?: string) {
    const filter = status ? { status } : {};
    return await this.poModel
      .find(filter)
      .populate('supplierId', 'supplierName')
      .sort({ createdAt: -1 })
      .exec();
  }

  // Updates PO status (e.g., moving from Draft to Sent)
  async updateStatus(id: string, status: string) {
    const po = await this.poModel.findByIdAndUpdate(id, { status }, { new: true });
    if (!po) throw new NotFoundException('Purchase Order not found');
    return po;
  }

  // Records partial or full receipt of items to update progress (e.g., 25/40 units)
  async receiveItems(poId: string, itemId: string, qty: number) {
    const po = await this.poModel.findById(poId);
    if (!po) throw new NotFoundException('PO not found');

    const item = po.items.find((i) => i.itemId.toString() === itemId);
    if (!item) throw new NotFoundException('Item not found in this PO');

    item.quantityReceived += qty;

    // Update PO status based on overall progress
    const allReceived = po.items.every(i => i.quantityReceived >= i.quantityRequested);
    const anyReceived = po.items.some(i => i.quantityReceived > 0);
    
    po.status = allReceived ? 'Received' : anyReceived ? 'Partial' : 'Sent';

    return await po.save();
  }
}