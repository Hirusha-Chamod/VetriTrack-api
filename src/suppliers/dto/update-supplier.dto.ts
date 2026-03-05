import { PartialType } from '@nestjs/mapped-types';
import { CreateSupplierDto } from './create-supplier.dto';

// Inherits all validation rules but makes every field optional
export class UpdateSupplierDto extends PartialType(CreateSupplierDto) {}