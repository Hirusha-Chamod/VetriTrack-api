import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ApprovalRequest } from './schemas/request.schema';
import { CreateRequestDto } from './dto/create-request.dto';
import { PurchaseOrdersService } from '../purchase-orders/purchase-orders.service';

@Injectable()
export class ApprovalsService {
  constructor(
    @InjectModel(ApprovalRequest.name) private approvalModel: Model<ApprovalRequest>,
    // INJECT the PurchaseOrdersService
    private readonly poService: PurchaseOrdersService,
  ) {}

  async create(createDto: CreateRequestDto, userId: string) {
    const totalAmount = createDto.quantity * createDto.unitPrice;
    
    return this.approvalModel.create({
      ...createDto,
      totalAmount,
      requestedBy: userId,
      status: 'pending',
    });
  }

  async findAllPending() {
    return this.approvalModel.find({ status: 'pending' })
      .populate('requestedBy', 'fullName')
      .populate('itemId', 'itemName')
      .populate('supplierId', 'supplierName')
      .sort({ createdAt: -1 });
  }

  async updateStatus(id: string, status: 'approved' | 'rejected', adminId: string) {
    
    const request = await this.approvalModel.findById(id);
    if (!request) throw new NotFoundException('Request not found');
    if (request.status !== 'pending') throw new BadRequestException('Request already processed');

    
    request.status = status;
    request.reviewedBy = adminId as any;
    await request.save();

    
    if (status === 'approved') {
      
      const draftPO = await this.poService.createDraft({
        supplierId: request.supplierId.toString(),
        notes: `Automatically generated from approved request: ${request.reason}`,
      });

      await this.poService.addItemToDraft(draftPO._id.toString(), {
        itemId: request.itemId.toString(),
        quantity: request.quantity,
        unitPrice: request.unitPrice,
      });
    }

    return request;
  }
}