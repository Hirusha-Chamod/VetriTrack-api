import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Patch, 
  Param, 
  UseGuards, 
  Query, 
  Res, 
  UseInterceptors, 
  UploadedFile, 
  BadRequestException 
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import express from 'express';

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

  @Patch('item/:id')
  @Roles('owner')
  updateItem(
    @Param('id') id: string,
    @Body() updateItemDto: any // You can replace 'any' with an UpdateItemDto if you have one!
  ) {
    return this.inventoryService.updateItem(id, updateItemDto);
  }
  
  @Get('items')
  @Roles('owner', 'staff')
  findAll(@Query() query: any) { 
    return this.inventoryService.findAllItems(query);
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


  @Get('export/excel')
  @Roles('owner', 'staff')
  async exportExcel(@Res() res: express.Response) {
    const buffer = await this.inventoryService.exportToExcel();
    
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="vetritrack_inventory.xlsx"',
    });
    
    res.send(buffer);
  }

  
  @Post('upload')
  @Roles('owner', 'staff')
  @UseInterceptors(FileInterceptor('file'))
  async uploadInventory(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Please upload a file');

    const allowedMimeTypes = [
      'text/csv',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 
      'application/vnd.ms-excel', 
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Invalid file type. Please upload a .csv or .xlsx file.');
    }

    return await this.inventoryService.importFromBuffer(file.buffer);
  }
}