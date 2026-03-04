import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { AuthGuard } from '@nestjs/passport';
import { AddBatchDto } from './dto/add-batch.dto';
import { CreateItemDto } from './dto/create-item.dto';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  // Creates a new product item
  @Post('item')
  @UseGuards(AuthGuard('jwt'))
  createItem(@Body() createItemDto: CreateItemDto) {
    return this.inventoryService.createItem(createItemDto);
  }

  // Records a new stock batch arrival
  @Post('batch')
  @UseGuards(AuthGuard('jwt'))
  addBatch(@Body() addBatchDto: AddBatchDto) {
    return this.inventoryService.addBatch(addBatchDto);
  }

  // Fetches the list of all products
  @Get('items')
  @UseGuards(AuthGuard('jwt'))
  findAll() {
    return this.inventoryService.findAllItems();
  }

  // Returns the recommended batch based on the earliest expiry date
  @Get('suggest/:itemId')
  @UseGuards(AuthGuard('jwt'))
  getSuggestion(@Param('itemId') itemId: string) {
    return this.inventoryService.suggestFefoBatch(itemId);
  }
}