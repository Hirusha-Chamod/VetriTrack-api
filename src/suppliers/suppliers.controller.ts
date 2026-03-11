import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, BadRequestException, UploadedFile, UseInterceptors } from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { RolesGuard } from 'src/auth/guards/roles.guard';

@Controller('suppliers')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('owner')
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  // Handles the "Save" button on your Add Supplier form - Owner only
  @Post()
  create(@Body() createSupplierDto: CreateSupplierDto) {
    return this.suppliersService.create(createSupplierDto);
  }

  // Fetches all suppliers for the management list or dropdowns - Owner only
  @Get()
  findAll() {
    return this.suppliersService.findAll();
  }

  // Gets details for a specific supplier - Owner only
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.suppliersService.findOne(id);
  }

  // Updates general info (Contact Name, Email, Address, etc.) - Owner only
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateSupplierDto: UpdateSupplierDto) {
    return this.suppliersService.update(id, updateSupplierDto);
  }

  // Updates supplier status - Owner only
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string, 
    @Body('status') status: 'Active' | 'Inactive'
  ) {
    return this.suppliersService.updateStatus(id, status);
  }

  // Removes a supplier record - Owner only
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.suppliersService.remove(id);
  }

  // Bulk imports suppliers from file - Owner only
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadSuppliers(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Please upload a file');
    }

    // Validate that the file is either Excel or CSV
    const allowedMimeTypes = [
      'text/csv',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Invalid file type. Please upload a .csv or .xlsx file.');
    }

    return await this.suppliersService.importFromBuffer(file.buffer);
  }
}