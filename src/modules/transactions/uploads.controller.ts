import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  CurrentUser,
  type AuthUser,
} from '../../common/decorators/current-user.decorator.js';
import { UploadsDocs } from './docs/uploads.docs.js';
import { PaginationQueryDto } from './dtos/pagination-query.dto.js';
import {
  MAX_UPLOAD_BYTES,
  type UploadedCsvFile,
} from './services/csv-reader.service.js';
import { TransactionsService } from './transactions.service.js';

const CSV_MIME_TYPES = ['text/csv', 'application/csv', 'application/vnd.ms-excel', 'text/plain'];

// Each account uploads, follows and rescores only its own uploads
@ApiTags('uploads')
@Controller('uploads')
export class UploadsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  // Kept in memory only (never written to disk), max 5 MB
  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
      fileFilter: (_req, file, accept) =>
        file.originalname.toLowerCase().endsWith('.csv') &&
        CSV_MIME_TYPES.includes(file.mimetype)
          ? accept(null, true)
          : accept(new BadRequestException('Only .csv files are accepted'), false),
    }),
  )
  @UploadsDocs.Upload()
  upload(
    @UploadedFile() file: UploadedCsvFile | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    return this.transactionsService.upload(file, user);
  }

  @Post('score-unscored')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UploadsDocs.ScoreUnscored()
  scoreUnscored(@CurrentUser() user: AuthUser) {
    return this.transactionsService.scoreUnscored(user);
  }

  @Post(':id/rescore')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UploadsDocs.Rescore()
  rescore(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.transactionsService.rescoreUpload(id, user);
  }

  @Get()
  @UploadsDocs.List()
  list(@Query() query: PaginationQueryDto, @CurrentUser() user: AuthUser) {
    return this.transactionsService.listUploads(query, user);
  }

  @Get(':id')
  @UploadsDocs.Get()
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.transactionsService.getUpload(id, user);
  }

  @Get(':id/rejected')
  @UploadsDocs.Rejected()
  rejected(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PaginationQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.transactionsService.listRejectedRows(id, query, user);
  }
}
