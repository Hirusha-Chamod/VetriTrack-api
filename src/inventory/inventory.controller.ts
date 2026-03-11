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

  // Creates a new master product - Owner only
  @Post('item')
  @Roles('owner')
  createItem(@Body() createItemDto: CreateItemDto) {
    return this.inventoryService.createItem(createItemDto);
  }

  // Adds a specific stock delivery to an item - Owner and Staff
  @Post('batch')
  @Roles('owner', 'staff')
  addBatch(@Body() addBatchDto: AddBatchDto) {
    return this.inventoryService.addBatch(addBatchDto);
  }

  // Retrieves all master items - Owner and Staff
  @Get('items')
  @Roles('owner', 'staff')
  findAll() {
    return this.inventoryService.findAllItems();
  }

  // Generates the full expiry report with item and supplier details - Owner and Staff
  @Get('expiry-report')
  @Roles('owner', 'staff')
  getExpiryReport() {
    return this.inventoryService.getExpiryReport();
  }

  // Returns only items that are below their minimum stock level - Owner and Staff
  @Get('alerts/low-stock')
  @Roles('owner', 'staff')
  getLowStock() {
    return this.inventoryService.getLowStockAlerts();
  }

  // Updates the reorder threshold - Owner only
  @Patch('reorder-level/:itemId')
  @Roles('owner')
  updateReorder(
    @Param('itemId') itemId: string,
    @Body('minLevel') minLevel: number,
  ) {
    return this.inventoryService.updateReorderLevel(itemId, minLevel);
  }

  // Identifies the best batch to use next based on FEFO - Owner and Staff
  @Get('suggest/:itemId')
  @Roles('owner', 'staff')
  getSuggestion(@Param('itemId') itemId: string) {
    return this.inventoryService.suggestFefoBatch(itemId);
  }

  // Fetches all batches for a specific item (View Batches dialog) - Owner and Staff
  @Get('batches/:itemId')
  @Roles('owner', 'staff')
  getItemBatches(@Param('itemId') itemId: string) {
    return this.inventoryService.findBatchesByItem(itemId);
  }
}