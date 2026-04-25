import { Controller, Get, Post, Body, Patch, Param, Query, UseGuards, Delete } from '@nestjs/common';
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

  @Post('draft')
  @Roles('owner', 'staff')
  createDraft(@Body() createPoDto: CreatePoDto) {
    return this.poService.createDraft(createPoDto);
  }

  @Patch('draft/:id/add-item')
  @Roles('owner', 'staff')
  addItem(@Param('id') id: string, @Body() addItemDto: AddPoItemDto) {
    return this.poService.addItemToDraft(id, addItemDto);
  }

  // 👇 NEW: Remove a specific item from a Draft PO
  @Delete('draft/:id/remove-item/:itemId')
  @Roles('owner', 'staff')
  removeItemFromDraft(
    @Param('id') id: string, 
    @Param('itemId') itemId: string
  ) {
    return this.poService.removeItemFromDraft(id, itemId);
  }

  // 👇 NEW: Delete a Draft PO completely
  @Delete('draft/:id')
  @Roles('owner', 'staff')
  deleteDraft(@Param('id') id: string) {
    return this.poService.deleteDraft(id);
  }

  @Get('drafts')
  @Roles('owner', 'staff')
  getDrafts() {
    return this.poService.findDrafts();
  }

  @Get()
  @Roles('owner', 'staff')
  findAll(@Query('status') status?: string) {
    return this.poService.findAll(status);
  }

  @Patch(':id/status')
  @Roles('owner', 'staff')
  updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.poService.updateStatus(id, status);
  }

  @Patch(':id/receive')
  @Roles('owner', 'staff')
  receiveItems(
    @Param('id') id: string,
    @Body('itemId') itemId: string,
    @Body('quantity') quantity: number,
    @Body('discountType') discountType?: 'Percentage' | 'Value' | 'None',
    @Body('discountValue') discountValue?: number,
  ) {
    return this.poService.receiveItems(
      id, 
      itemId, 
      quantity, 
      discountType, 
      discountValue
    );
  }

  @Post(':id/remind')
  async sendReminderEmail(@Param('id') id: string) {
    return await this.poService.sendReminder(id);
  }
}