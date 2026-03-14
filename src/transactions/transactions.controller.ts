import { Controller, Post, Body, Get, UseGuards, Req } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { RolesGuard } from 'src/auth/guards/roles.guard';

@Controller('transactions')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  // Handles 'Receive Stock' and 'Issue Stock (FEFO)' - Owner and Staff
  @Post()
  @Roles('owner', 'staff')
  create(@Body() createDto: CreateTransactionDto, @Req() req: any) {
    return this.transactionsService.create(createDto, req.user.id);
  }

  // Provides data for the Transaction History list - Owner only
  @Get()
   @Roles('owner', 'staff')
  findAll() {
    return this.transactionsService.findAll();
  }
}