import { Controller, Get, Post, Body, Patch, Param, UseGuards, Req } from '@nestjs/common';
import { ApprovalsService } from './approvals.service';
import { AuthGuard } from '@nestjs/passport';
import { CreateRequestDto } from './dto/create-request.dto';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { RolesGuard } from 'src/auth/guards/roles.guard';

@Controller('approvals')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class ApprovalsController {
  constructor(private readonly approvalsService: ApprovalsService) {}

  // Creates a new approval request - Owner and Staff
  @Post()
  @Roles('owner', 'staff')
  create(@Body() createDto: CreateRequestDto, @Req() req: any) {
    return this.approvalsService.create(createDto, req.user.id);
  }

  // Gets all pending approval requests - Owner only
  @Get('pending')
  @Roles('owner')
  findAll() {
    return this.approvalsService.findAllPending();
  }

  // Updates approval request status (approve/reject) - Owner only
  @Patch(':id/status')
  @Roles('owner')
  updateStatus(
    @Param('id') id: string, 
    @Body('status') status: 'approved' | 'rejected',
    @Req() req: any
  ) {
    return this.approvalsService.updateStatus(id, status, req.user.id);
  }
}