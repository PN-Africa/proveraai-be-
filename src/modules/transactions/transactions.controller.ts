import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  StreamableFile,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  CurrentUser,
  type AuthUser,
} from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Role } from '../auth/enums/role.enum.js';
import { TransactionsDocs } from './docs/transactions.docs.js';
import { DateRangeQueryDto } from './dtos/date-range-query.dto.js';
import { ListTransactionsQueryDto } from './dtos/list-transactions-query.dto.js';
import { ReviewDecisionDto } from './dtos/review-decision.dto.js';
import { TransactionsService } from './transactions.service.js';

// Viewing is open to every signed-in account; reviewing is for analysts
@ApiTags('transactions')
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  @TransactionsDocs.List()
  list(@Query() query: ListTransactionsQueryDto, @CurrentUser() user: AuthUser) {
    return this.transactionsService.listTransactions(query, user);
  }

  @Get(':id')
  @TransactionsDocs.Get()
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.transactionsService.getTransaction(id, user);
  }

  @Get(':id/customer-history')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @TransactionsDocs.CustomerHistory()
  async customerHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() range: DateRangeQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    const file = await this.transactionsService.exportCustomerHistory(id, range, user);
    return new StreamableFile(file.content, {
      type: 'text/csv; charset=utf-8',
      disposition: `attachment; filename="${file.fileName}"`,
      length: file.content.length,
    });
  }

  @Post(':id/review/claim')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ANALYST)
  @TransactionsDocs.Claim()
  claim(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() analyst: AuthUser) {
    return this.transactionsService.claimReview(id, analyst);
  }

  @Patch(':id/review')
  @Roles(Role.ANALYST)
  @TransactionsDocs.Decide()
  decide(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewDecisionDto,
    @CurrentUser() analyst: AuthUser,
  ) {
    return this.transactionsService.decideReview(id, dto, analyst);
  }
}
