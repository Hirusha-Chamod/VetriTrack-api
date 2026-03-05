import { Controller, Get, Post, Body, Patch, Param, UseGuards } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { AuthGuard } from '@nestjs/passport';
import { AddBatchDto } from './dto/add-batch.dto';
import { CreateItemDto } from './dto/create-item.dto';

@Controller('inventory')
@UseGuards(AuthGuard('jwt')) 
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  // Creates a new master product
  @Post('item')
  createItem(@Body() createItemDto: CreateItemDto) {
    return this.inventoryService.createItem(createItemDto);
  }

  // Adds a specific stock delivery to an item
  @Post('batch')
  addBatch(@Body() addBatchDto: AddBatchDto) {
    return this.inventoryService.addBatch(addBatchDto);
  }

  // Retrieves all master items
  @Get('items')
  findAll() {
    return this.inventoryService.findAllItems();
  }

  // Generates the full expiry report with item and supplier details
  @Get('expiry-report')
  getExpiryReport() {
    return this.inventoryService.getExpiryReport();
  }

  // Returns only items that are below their minimum stock level
  @Get('alerts/low-stock')
  getLowStock() {
    return this.inventoryService.getLowStockAlerts();
  }

  // Updates the reorder threshold 
  @Patch('reorder-level/:itemId')
  updateReorder(
    @Param('itemId') itemId: string,
    @Body('minLevel') minLevel: number,
  ) {
    return this.inventoryService.updateReorderLevel(itemId, minLevel);
  }

  // Identifies the best batch to use next based on FEFO
  @Get('suggest/:itemId')
  getSuggestion(@Param('itemId') itemId: string) {
    return this.inventoryService.suggestFefoBatch(itemId);
  }

  // Fetches all batches for a specific item (View Batches dialog)
  @Get('batches/:itemId')
  getItemBatches(@Param('itemId') itemId: string) {
    return this.inventoryService.findBatchesByItem(itemId);
  }
}