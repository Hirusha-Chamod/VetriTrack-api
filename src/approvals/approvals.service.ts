import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
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
      requestedBy: new Types.ObjectId(userId),
      status: 'pending',
    });
  }

async findMyRequests(userId: string) {
    return this.approvalModel.find({ 
      requestedBy: new Types.ObjectId(userId) 
    })
      .populate('requestedBy', 'fullName') 
      .populate('itemId', 'itemName')
      .populate('supplierId', 'supplierName')
      .sort({ createdAt: -1 });
  }

  async findAllPending() {
    return this.approvalModel.find({ status: 'pending' })
      .populate('requestedBy', 'fullName') 
      .populate('itemId', 'itemName')
      .populate('supplierId', 'supplierName')
      .sort({ createdAt: -1 });
  }

 async updateStatus(id: string, status: string, adminId: string) {
    const request = await this.approvalModel.findById(id);
    if (!request) throw new NotFoundException('Request not found');
    if (request.status !== 'pending') throw new BadRequestException('Request already processed');

    request.status = status;
    request.reviewedBy = adminId as any;

    if (status === 'approved') {
      // Create the PO
      const draftPO = await this.poService.createDraft({
        supplierId: request.supplierId.toString(),
        notes: `Automatically generated from approved request: ${request.reason}`,
      });

      await this.poService.addItemToDraft(draftPO._id.toString(), {
        itemId: request.itemId.toString(),
        quantity: request.quantity,
        unitPrice: request.unitPrice,
      });

      request.linkedPOId = draftPO._id as any;
      request.status = 'addedToDraftPO'; 
    }

    await request.save();
    return request;
  }
}