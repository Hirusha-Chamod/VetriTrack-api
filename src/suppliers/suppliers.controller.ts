import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, BadRequestException, UploadedFile, UseInterceptors, Res } from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import express from 'express'; // 👇 Needed for file downloads

@Controller('suppliers')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('owner')
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Post()
  @Roles('owner', 'staff')
  create(@Body() createSupplierDto: CreateSupplierDto) {
    return this.suppliersService.create(createSupplierDto);
  }

  @Get()
  @Roles('owner', 'staff')
  findAll() {
    return this.suppliersService.findAll();
  }

  // ─── EXPORT ENDPOINT ──────────────────────────────────────────────────────
  // Placed BEFORE the ':id' route so it doesn't get confused thinking "export" is an ID
  @Get('export/excel')
  @Roles('owner', 'staff')
  async exportExcel(@Res() res: express.Response) {
    const buffer = await this.suppliersService.exportToExcel();
    
    // Tell the browser/app to download this as an Excel file
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="vetritrack_suppliers.xlsx"',
    });
    
    res.send(buffer);
  }

  @Get(':id')
  @Roles('owner', 'staff')
  findOne(@Param('id') id: string) {
    return this.suppliersService.findOne(id);
  }

  @Patch(':id')
  @Roles('owner', 'staff')
  update(@Param('id') id: string, @Body() updateSupplierDto: UpdateSupplierDto) {
    return this.suppliersService.update(id, updateSupplierDto);
  }

  @Patch(':id/status')
  @Roles('owner', 'staff')
  updateStatus(
    @Param('id') id: string, 
    @Body('status') status: 'Active' | 'Inactive'
  ) {
    return this.suppliersService.updateStatus(id, status);
  }

  @Delete(':id')
  @Roles('owner', 'staff')
  remove(@Param('id') id: string) {
    return this.suppliersService.remove(id);
  }

  // ─── IMPORT ENDPOINT ──────────────────────────────────────────────────────
  @Post('upload')
  @Roles('owner', 'staff')
  @UseInterceptors(FileInterceptor('file'))
  async uploadSuppliers(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Please upload a file');
    }

    const allowedMimeTypes = [
      'text/csv',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 
      'application/vnd.ms-excel', 
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Invalid file type. Please upload a .csv or .xlsx file.');
    }

    return await this.suppliersService.importFromBuffer(file.buffer);
  }
}