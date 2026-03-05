import { Controller, Get, Post, Body, Patch, Param, Query, UseGuards } from '@nestjs/common';
import { PurchaseOrdersService } from './purchase-orders.service';
import { AddPoItemDto } from './dto/add-po-item.dto';
import { AuthGuard } from '@nestjs/passport';
import { CreatePoDto } from './dto/create-po.dto';

@Controller('purchase-orders')
@UseGuards(AuthGuard('jwt'))
export class PurchaseOrdersController {
  constructor(private readonly poService: PurchaseOrdersService) {}

  // Step 1: Initialize a new Draft PO
  @Post('draft')
  createDraft(@Body() createPoDto: CreatePoDto) {
    return this.poService.createDraft(createPoDto);
  }

  // Step 2 & 3: Add items to the draft
  @Patch('draft/:id/add-item')
  addItem(@Param('id') id: string, @Body() addItemDto: AddPoItemDto) {
    return this.poService.addItemToDraft(id, addItemDto);
  }

  // Gets all drafts (grouped for the "Draft POs" screen)
  @Get('drafts')
  getDrafts() {
    return this.poService.findDrafts();
  }

  // Main list for the "Purchase Orders" screen (supports ?status=Sent)
  @Get()
  findAll(@Query('status') status?: string) {
    return this.poService.findAll(status);
  }

  // Updates status (e.g., clicking "Send" in the UI)
  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.poService.updateStatus(id, status);
  }

  // Called when stock actually arrives at the clinic
  @Patch(':id/receive')
  receiveItems(
    @Param('id') id: string,
    @Body('itemId') itemId: string,
    @Body('quantity') quantity: number,
  ) {
    return this.poService.receiveItems(id, itemId, quantity);
  }
}