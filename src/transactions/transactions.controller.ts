import { Controller, Post, Body, Get, UseGuards, Req } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { AuthGuard } from '@nestjs/passport';

@Controller('transactions')
@UseGuards(AuthGuard('jwt')) // Protect all transaction routes
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  // Handles 'Receive Stock' and 'Issue Stock (FEFO)'
  @Post()
  create(@Body() createDto: CreateTransactionDto, @Req() req: any) {
    // req.user.id comes from the JWT Strategy we built earlier
    return this.transactionsService.create(createDto, req.user.id);
  }

  // Provides data for the Transaction History list
  @Get()
  findAll() {
    return this.transactionsService.findAll();
  }
}