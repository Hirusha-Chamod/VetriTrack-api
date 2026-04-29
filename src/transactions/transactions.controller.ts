import { 
  Controller, 
  Post, 
  Body, 
  Get, 
  UseGuards, 
  Req, 
  Res, 
  UseInterceptors, 
  UploadedFile, 
  BadRequestException 
} from '@nestjs/common';
import express from 'express'; 
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('transactions')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post()
  @Roles('owner', 'staff')
  create(@Body() createDto: CreateTransactionDto, @Req() req: any) {
    return this.transactionsService.create(createDto, req.user.id);
  }

  @Get()
  @Roles('owner', 'staff')
  findAll() {
    return this.transactionsService.findAll();
  }


  @Get('export/excel')
  @Roles('owner', 'staff') 
  async exportTransactions(@Res() res: express.Response) {
    try {
      const buffer = await this.transactionsService.exportToExcel();

      // Get current date for a clean filename
      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `Transactions_Export_${dateStr}.xlsx`;

      // Set headers to force the browser/client to download the file
      res.set({
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.length,
      });

      // Send the binary buffer
      res.end(buffer);
    } catch (error) {
      console.error('Export Error:', error);
      res.status(500).json({ message: 'Failed to generate export file' });
    }
  }

  @Post('import')
  @Roles('owner', 'staff')
  @UseInterceptors(FileInterceptor('file'))
  async importTransactions(@UploadedFile() file: Express.Multer.File, @Req() req: any) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    return this.transactionsService.importFromBuffer(file.buffer, req.user.id);
  }

  @Get('seed')
  @Roles('owner')
  seedHistoricalTransactions() {
    return this.transactionsService.seedHistoricalTransactions();
  }
}