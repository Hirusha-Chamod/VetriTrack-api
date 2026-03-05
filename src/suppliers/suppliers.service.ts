import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { Supplier } from './schema/supplier.schema';
import * as XLSX from 'xlsx';

@Injectable()
export class SuppliersService {
  constructor(
    @InjectModel(Supplier.name) private supplierModel: Model<Supplier>,
  ) {}

  // Registers a new supplier and checks if the name already exists
  async create(dto: CreateSupplierDto) {
    const existing = await this.supplierModel.findOne({ supplierName: dto.supplierName });
    if (existing) {
      throw new ConflictException('Supplier name already exists');
    }
    return await this.supplierModel.create(dto);
  }

  // Returns all suppliers (useful for dropdowns in Add Batch/Approvals)
  async findAll() {
    return await this.supplierModel.find().sort({ supplierName: 1 }).exec();
  }

  // Finds a specific supplier by ID
  async findOne(id: string) {
    const supplier = await this.supplierModel.findById(id).exec();
    if (!supplier) throw new NotFoundException('Supplier not found');
    return supplier;
  }

  // Updates supplier details (Contact info, Address, etc.)
  async update(id: string, dto: UpdateSupplierDto) {
    const updated = await this.supplierModel.findByIdAndUpdate(id, dto, { new: true });
    if (!updated) throw new NotFoundException('Supplier not found');
    return updated;
  }

  // Specific method to change status (Active/Inactive) from the mobile view
  async updateStatus(id: string, status: 'Active' | 'Inactive') {
    const updated = await this.supplierModel.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );
    if (!updated) throw new NotFoundException('Supplier not found');
    return updated;
  }

  // Removes a supplier from the system
  async remove(id: string) {
    const result = await this.supplierModel.findByIdAndDelete(id);
    if (!result) throw new NotFoundException('Supplier not found');
    return { deleted: true };
  }

  async importFromBuffer(buffer: Buffer) {
    try {
      // Read the buffer (works for both .csv and .xlsx)
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      
      // Get the first sheet
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // Convert sheet to JSON array
      const rawData = XLSX.utils.sheet_to_json(worksheet);

      // Map and Validate the data
      const mappedSuppliers = rawData.map(row => this.mapRowToSchema(row));

      // Bulk Insert
      return await this.supplierModel.insertMany(mappedSuppliers);
    } catch (error) {
      throw new BadRequestException('Failed to parse file. Ensure headers match the template.');
    }
  }

  private mapRowToSchema(data: any) {
    return {
      supplierName: data['Name'] || data['Supplier Name'],
      contactPerson: data['Contact'] || data['Contact Person'],
      email: data['Email'],
      phone: data['Phone'] || data['Telephone'],
      leadTime: parseInt(data['LeadTime'] || data['Lead Time']) || 3,
      status: 'Active',
    };
  }
}