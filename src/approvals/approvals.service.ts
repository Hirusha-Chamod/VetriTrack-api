import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ApprovalRequest } from './schemas/request.schema';
import { CreateRequestDto } from './dto/create-request.dto';

@Injectable()        
export class ApprovalsService {
  constructor(
    @InjectModel(ApprovalRequest.name) private approvalModel: Model<ApprovalRequest>,
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
      .populate('itemId', 'name')
      .sort({ createdAt: -1 });
  }

  async updateStatus(id: string, status: 'approved' | 'rejected', adminId: string) {
    const request = await this.approvalModel.findByIdAndUpdate(
      id,
      { status, reviewedBy: adminId },
      { new: true }
    );
    
    if (!request) throw new NotFoundException('Request not found');
    return request;
  }
}