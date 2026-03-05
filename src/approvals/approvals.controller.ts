import { Controller, Get, Post, Body, Patch, Param, UseGuards, Req } from '@nestjs/common';
import { ApprovalsService } from './approvals.service';
import { AuthGuard } from '@nestjs/passport';
import { CreateRequestDto } from './dto/create-request.dto';

@Controller('approvals')
@UseGuards(AuthGuard('jwt'))
export class ApprovalsController {
  constructor(private readonly approvalsService: ApprovalsService) {}

  @Post()
  create(@Body() createDto: CreateRequestDto, @Req() req: any) {
    return this.approvalsService.create(createDto, req.user.id);
  }

  @Get('pending')
  findAll() {
    return this.approvalsService.findAllPending();
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string, 
    @Body('status') status: 'approved' | 'rejected',
    @Req() req: any
  ) {
    // Only 'owner' role should technically be able to call this (we can add a RoleGuard later)
    return this.approvalsService.updateStatus(id, status, req.user.id);
  }
}