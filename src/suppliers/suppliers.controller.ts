import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { AuthGuard } from '@nestjs/passport';

@Controller('suppliers')
@UseGuards(AuthGuard('jwt'))
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  // Handles the "Save" button on your Add Supplier form
  @Post()
  create(@Body() createSupplierDto: CreateSupplierDto) {
    return this.suppliersService.create(createSupplierDto);
  }

  // Fetches all suppliers for the management list or dropdowns
  @Get()
  findAll() {
    return this.suppliersService.findAll();
  }

  // Gets details for a specific supplier
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.suppliersService.findOne(id);
  }

  // Updates general info (Contact Name, Email, Address, etc.)
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateSupplierDto: UpdateSupplierDto) {
    return this.suppliersService.update(id, updateSupplierDto);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string, 
    @Body('status') status: 'Active' | 'Inactive'
  ) {
    return this.suppliersService.updateStatus(id, status);
  }

  // Removes a supplier record
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.suppliersService.remove(id);
  }
}