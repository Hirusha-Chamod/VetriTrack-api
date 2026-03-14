import { Controller, Get, Post, Body, Patch, Param, Query, UseGuards } from '@nestjs/common';
import { PurchaseOrdersService } from './purchase-orders.service';
import { AddPoItemDto } from './dto/add-po-item.dto';
import { AuthGuard } from '@nestjs/passport';
import { CreatePoDto } from './dto/create-po.dto';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { RolesGuard } from 'src/auth/guards/roles.guard';

@Controller('purchase-orders')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class PurchaseOrdersController {
  constructor(private readonly poService: PurchaseOrdersService) {}

  // Step 1: Initialize a new Draft PO - Owner only
  @Post('draft')
   @Roles('owner', 'staff')
  createDraft(@Body() createPoDto: CreatePoDto) {
    return this.poService.createDraft(createPoDto);
  }

  // Step 2 & 3: Add items to the draft - Owner only
  @Patch('draft/:id/add-item')
   @Roles('owner', 'staff')
  addItem(@Param('id') id: string, @Body() addItemDto: AddPoItemDto) {
    return this.poService.addItemToDraft(id, addItemDto);
  }

  // Gets all drafts (grouped for the "Draft POs" screen) - Owner only
  @Get('drafts')
   @Roles('owner', 'staff')
  getDrafts() {
    return this.poService.findDrafts();
  }

  // Main list for the "Purchase Orders" screen (supports ?status=Sent) - Owner only
  @Get()
   @Roles('owner', 'staff')
  findAll(@Query('status') status?: string) {
    return this.poService.findAll(status);
  }

  // Updates status (e.g., clicking "Send" in the UI) - Owner only
  @Patch(':id/status')
   @Roles('owner', 'staff')
  updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.poService.updateStatus(id, status);
  }

  // Called when stock actually arrives at the clinic - Owner and Staff
  @Patch(':id/receive')
  @Roles('owner', 'staff')
  receiveItems(
    @Param('id') id: string,
    @Body('itemId') itemId: string,
    @Body('quantity') quantity: number,
  ) {
    return this.poService.receiveItems(id, itemId, quantity);
  }
}