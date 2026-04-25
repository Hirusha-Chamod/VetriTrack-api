import { Controller, Post, Body, Get, UseGuards, Req, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
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

  seedHistoricalTransactions() {
    return this.transactionsService.seedHistoricalTransactions();
  }
}