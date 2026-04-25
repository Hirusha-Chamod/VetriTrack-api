import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { Supplier } from './schema/supplier.schema';
import * as XLSX from 'xlsx';

@Injectable()
export class SuppliersService {
  constructor(
    @InjectModel(Supplier.name) private supplierModel: Model<Supplier>,
  ) {}

  async create(dto: CreateSupplierDto) {
    // Check for both name AND email to prevent duplicate
    console.log("Attempting to create supplier with name:", dto);
    const existing = await this.supplierModel.findOne({
      $or: [{ supplierName: dto.supplierName }, { email: dto.email }]
    });
    if (existing) {
      throw new ConflictException('Supplier name or email already exists');
    }
    return await this.supplierModel.create(dto);
  }

  async findAll(inventoryItemIds?: string | string[]) {
    const filter: any = {};

    if (inventoryItemIds) {
      const ids = Array.isArray(inventoryItemIds)
        ? inventoryItemIds
        : inventoryItemIds.split(',');

      const normalizedIds = ids
        .map((id) => id.trim())
        .filter((id) => id.length > 0);

      try {
        if (normalizedIds.length > 0) {
          filter.inventoryItemIds = { $in: normalizedIds.map((id) => new Types.ObjectId(id)) };
        }
      } catch (err) {
        throw new BadRequestException('inventoryItemIds must be valid Mongo ObjectId values');
      }
    }

    return await this.supplierModel.find(filter).sort({ supplierName: 1 }).exec();
  }

  async findOne(id: string) {
    const supplier = await this.supplierModel.findById(id).exec();
    if (!supplier) throw new NotFoundException('Supplier not found');
    return supplier;
  }

  async update(id: string, dto: UpdateSupplierDto) {
    const updated = await this.supplierModel.findByIdAndUpdate(id, dto, { new: true });
    if (!updated) throw new NotFoundException('Supplier not found');
    return updated;
  }

  async updateStatus(id: string, status: 'Active' | 'Inactive') {
    const updated = await this.supplierModel.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );
    if (!updated) throw new NotFoundException('Supplier not found');
    return updated;
  }

  async remove(id: string) {
    const result = await this.supplierModel.findByIdAndDelete(id);
    if (!result) throw new NotFoundException('Supplier not found');
    return { deleted: true };
  }

  // ─── IMPORT LOGIC (SMART UPSERT) ──────────────────────────────────────────
  async importFromBuffer(buffer: Buffer) {
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rawData = XLSX.utils.sheet_to_json(worksheet);

      const mappedSuppliers = rawData.map(row => this.mapRowToSchema(row));

      // Use bulkWrite for "Upserting" based on unique email
      const operations = mappedSuppliers.map(supplier => ({
        updateOne: {
          filter: { email: supplier.email }, // Match by email
          update: { $set: supplier },        // Update fields if exists
          upsert: true                       // Insert if it doesn't exist
        }
      }));

      const result = await this.supplierModel.bulkWrite(operations);
      
      return { 
        success: true, 
        message: `Successfully processed ${mappedSuppliers.length} suppliers.`,
        inserted: result.upsertedCount,
        updated: result.modifiedCount
      };
    } catch (error) {
      throw new BadRequestException('Failed to process file. Ensure emails are present and valid.');
    }
  }

  private mapRowToSchema(data: any) {
    // Fixed to perfectly match your Schema property names!
    return {
      supplierName: data['Supplier Name'] || data['Name'] || 'Unknown Supplier',
      contactName: data['Contact Name'] || data['Contact Person'] || data['Contact'] || 'Unknown',
      email: data['Email'], // Email is critical for the upsert logic
      phone: data['Phone'] || data['Telephone'] || 'N/A',
      address: data['Address'] || 'N/A',
      averageLeadTimeDays: parseInt(data['Lead Time'] || data['LeadTime']) || 3,
      status: 'Active',
    };
  }

  // ─── EXPORT LOGIC ─────────────────────────────────────────────────────────
  async exportToExcel(): Promise<Buffer> {
    const suppliers = await this.supplierModel.find().lean();
    
    // Format data cleanly for the Excel file
    const exportData = suppliers.map(s => ({
      'Supplier Name': s.supplierName,
      'Contact Name': s.contactName,
      'Email': s.email,
      'Phone': s.phone,
      'Address': s.address,
      'Lead Time': s.averageLeadTimeDays,
      'Status': s.status,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Suppliers');
    
    // Return as a Buffer so the controller can send it as a file download
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }
}