import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SuppliersService } from './suppliers.service';
import { SuppliersController } from './suppliers.controller';
import { Supplier, SupplierSchema } from './schema/supplier.schema';
import { AuthModule } from 'src/auth/auth.module';


@Module({
  imports: [
    MongooseModule.forFeature([{ name: Supplier.name, schema: SupplierSchema }]),
    AuthModule, 
  ],
  
  controllers: [SuppliersController],
  providers: [SuppliersService],
  exports: [SuppliersService], // Exporting so Inventory can use it later
})
export class SuppliersModule {}