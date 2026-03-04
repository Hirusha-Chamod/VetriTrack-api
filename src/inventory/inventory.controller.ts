import { Controller, Get, Post, Body, Patch, Param, UseGuards } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { AuthGuard } from '@nestjs/passport';
import { AddBatchDto } from './dto/add-batch.dto';
import { CreateItemDto } from './dto/create-item.dto';

@Controller('inventory')
@UseGuards(AuthGuard('jwt')) // Protects all routes in this controller
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post('item')
  createItem(@Body() createItemDto: CreateItemDto) {
    return this.inventoryService.createItem(createItemDto);
  }

  @Post('batch')
  addBatch(@Body() addBatchDto: AddBatchDto) {
    return this.inventoryService.addBatch(addBatchDto);
  }

  @Get('items')
  findAll() {
    return this.inventoryService.findAllItems();
  }

  // New: Returns only items that are below their minimum stock level
  @Get('alerts/low-stock')
  getLowStock() {
    return this.inventoryService.getLowStockAlerts();
  }

  //  Updates the reorder threshold (Owner-only Reorder Settings)
  @Patch('reorder-level/:itemId')
  updateReorder(
    @Param('itemId') itemId: string,
    @Body('minLevel') minLevel: number,
  ) {
    return this.inventoryService.updateReorderLevel(itemId, minLevel);
  }

  @Get('suggest/:itemId')
  getSuggestion(@Param('itemId') itemId: string) {
    return this.inventoryService.suggestFefoBatch(itemId);
  }

  //  Fetches all batches for a specific item (for the "View Batches" dialog)
  @Get('batches/:itemId')
  getItemBatches(@Param('itemId') itemId: string) {
    return this.inventoryService.findBatchesByItem(itemId);
  }
}