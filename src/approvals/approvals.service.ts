import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ApprovalRequest } from './schemas/request.schema';
import { CreateRequestDto } from './dto/create-request.dto';
import { PurchaseOrdersService } from '../purchase-orders/purchase-orders.service';

/**
 * Service responsible for managing the Procurement Approval Workflow.
 * Acts as a gateway between Staff inventory requests and Manager budget controls,
 * automatically bridging approved requests into the Purchase Order pipeline.
 */
@Injectable()
export class ApprovalsService {
  constructor(
    @InjectModel(ApprovalRequest.name) private approvalModel: Model<ApprovalRequest>,
    private readonly poService: PurchaseOrdersService, // Injected to trigger downstream procurement
  ) {}

  // ============================================================================
  // REQUEST GENERATION & QUERYING
  // ============================================================================

  async create(createDto: CreateRequestDto, userId: string) {
    /*
     * Step 1: Capture the staff member's request.
     * Automatically calculates the projected cost to help managers make quick budget decisions.
     */
    const totalAmount = createDto.quantity * createDto.unitPrice;
    
    return this.approvalModel.create({
      ...createDto,
      totalAmount,
      requestedBy: new Types.ObjectId(userId),
      status: 'pending', // Locks the request in the manager's queue
    });
  }

  async findMyRequests(userId: string) {
    // Used by frontline staff to track the status of their own requests
    return this.approvalModel.find({ 
      requestedBy: new Types.ObjectId(userId) 
    })
      .populate('requestedBy', 'fullName') 
      .populate('itemId', 'itemName')
      .populate('supplierId', 'supplierName')
      .sort({ createdAt: -1 });
  }

  async findAllPending() {
    // Used by the Owner/Manager dashboard to clear their action queue
    return this.approvalModel.find({ status: 'pending' })
      .populate('requestedBy', 'fullName') 
      .populate('itemId', 'itemName')
      .populate('supplierId', 'supplierName')
      .sort({ createdAt: -1 });
  }

  // ============================================================================
  // WORKFLOW EXECUTION & AUTOMATION
  // ============================================================================

  async updateStatus(
    id: string, 
    status: string, 
    adminId: string, 
    finalQuantity?: number,
    finalSupplierId?: string
  ) {
    /*
     * Step 1: Validate State & Immutability.
     * Ensure a request isn't accidentally double-approved or modified after processing.
     */
    const request = await this.approvalModel.findById(id);
    if (!request) throw new NotFoundException('Request not found');
    if (request.status !== 'pending') throw new BadRequestException('Request already processed');

    request.status = status;
    request.reviewedBy = adminId as any;

    /*
     * Step 2: Apply Management Overrides.
     * Managers can adjust the quantity (e.g., ordering 10 instead of 5 to hit a bulk discount) 
     * or change the supplier based on current relationships/pricing before approving.
     */
    if (finalQuantity) request.quantity = finalQuantity;
    if (finalSupplierId) request.supplierId = new Types.ObjectId(finalSupplierId);

    /*
     * Step 3: Procurement Automation.
     * If the manager approves the request, we DO NOT make them manually re-enter data.
     * We seamlessly bridge the module by generating a Draft PO in the background.
     */
    if (status === 'approved') {
      
      // 3a. Instantiate the Draft PO container mapped to the chosen supplier
      const draftPO = await this.poService.createDraft({
        supplierId: request.supplierId.toString(),
        notes: `Automatically generated from approved request: ${request.reason}`,
      });

      // 3b. Push the specific item (with manager-approved quantities) into that draft
      await this.poService.addItemToDraft(draftPO._id.toString(), {
        itemId: request.itemId.toString(),
        quantity: request.quantity, 
        unitPrice: request.unitPrice,
      });

      /*
       * Step 4: Establish Traceability (Audit Trail).
       * We link the newly generated PO back to this request, and advance the status 
       * to signify that it has successfully crossed over into the Procurement pipeline.
       */
      request.linkedPOId = draftPO._id as any;
      request.status = 'addedToDraftPO'; 
    }

    await request.save();
    return request;
  }
}