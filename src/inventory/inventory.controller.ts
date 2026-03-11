import { Controller, Get, Post, Body, Patch, Param, UseGuards } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { AuthGuard } from '@nestjs/passport';
import { AddBatchDto } from './dto/add-batch.dto';
import { CreateItemDto } from './dto/create-item.dto';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { RolesGuard } from 'src/auth/guards/roles.guard';

@Controller('inventory')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post('item')
  @Roles('owner')
  createItem(@Body() createItemDto: CreateItemDto) {
    return this.inventoryService.createItem(createItemDto);
  }

  @Post('batch')
  @Roles('owner', 'staff')
  addBatch(@Body() addBatchDto: AddBatchDto) {
    return this.inventoryService.addBatch(addBatchDto);
  }

  @Get('items')
  @Roles('owner', 'staff')
  findAll() {
    return this.inventoryService.findAllItems();
  }

  @Get('expiry-report')
  @Roles('owner', 'staff')
  getExpiryReport() {
    return this.inventoryService.getExpiryReport();
  }

  @Get('alerts/low-stock')
  @Roles('owner', 'staff')
  getLowStock() {
    return this.inventoryService.getLowStockAlerts();
  }

  @Patch('reorder-level/:itemId')
  @Roles('owner')
  updateReorder(
    @Param('itemId') itemId: string,
    @Body('minLevel') minLevel: number,
  ) {
    return this.inventoryService.updateReorderLevel(itemId, minLevel);
  }

  @Get('suggest/:itemId')
  @Roles('owner', 'staff')
  getSuggestion(@Param('itemId') itemId: string) {
    return this.inventoryService.suggestFefoBatch(itemId);
  }

  @Get('batches/:itemId')
  @Roles('owner', 'staff')
  getItemBatches(@Param('itemId') itemId: string) {
    return this.inventoryService.findBatchesByItem(itemId);
  }
}